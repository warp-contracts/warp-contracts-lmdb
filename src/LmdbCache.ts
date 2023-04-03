import {
  CacheKey,
  CacheOptions,
  genesisSortKey,
  LoggerFactory,
  SortKeyCache,
  SortKeyCacheResult,
  PruneStats,
  BatchDBOp,
  lastPossibleSortKey
} from 'warp-contracts';
import { RootDatabase, open, RangeOptions } from 'lmdb';
import { LmdbOptions } from './LmdbOptions';
import { SortKeyCacheRangeOptions } from 'warp-contracts/lib/types/cache/SortKeyCacheRangeOptions';

export class LmdbCache<V = any> implements SortKeyCache<V> {
  private readonly logger = LoggerFactory.INST.create('LmdbCache');
  private readonly ongoingTransactionMark = '$$warp-internal-transaction$$';
  private readonly subLevelSeparator = '|';

  private db: RootDatabase<ClientValueWrapper<V>, string>;
  private rollbackBatch: () => void;

  constructor(private readonly cacheOptions: CacheOptions, private readonly lmdbOptions?: LmdbOptions) {
    if (!cacheOptions.dbLocation) {
      throw new Error('LmdbCache cache configuration error - no db location specified');
    }

    if (!lmdbOptions) {
      this.lmdbOptions = {
        maxEntriesPerContract: 10,
        minEntriesPerContract: 10
      };
    }

    this.logger.info(`Using location ${cacheOptions.dbLocation}`);
    this.db = open<ClientValueWrapper<V>, string>({
      path: `${cacheOptions.dbLocation}`,
      noSync: cacheOptions.inMemory
    });
  }

  /**
   * Batch operations are all executed in one transaction using childTransaction.
   * For each put there is an old entries removal run.
   */
  async batch(opStack: BatchDBOp<V>[]) {
    await this.db.transactionSync(async () => {
      for (const op of opStack) {
        if (op.type === 'put') {
          await this.doPut(op.key, new ClientValueWrapper(op.value));
          await this.removeOldestEntries(op.key);
        } else if (op.type === 'del') {
          await this.doDelete(op.key);
        }
      }
    });
  }

  async get(cacheKey: CacheKey, returnDeepCopy?: boolean): Promise<SortKeyCacheResult<V> | null> {
    const joinedKey = this.dbEntryKey(cacheKey);
    const result = this.db.get(joinedKey) || null;
    return this.joinedKeyResultToSortKeyCache({ key: joinedKey, value: result });
  }

  async getLast(key: string): Promise<SortKeyCacheResult<V> | null> {
    const result = this.db.getRange({
      start: `${key}${this.subLevelSeparator}${lastPossibleSortKey}`,
      reverse: true,
      limit: 1
    }).asArray;
    if (result.length && result[0].key.startsWith(key)) {
      return this.joinedKeyResultToSortKeyCache(result[0]);
    }
    return null;
  }

  async getLessOrEqual(key: string, sortKey: string): Promise<SortKeyCacheResult<V> | null> {
    const result = this.db.getRange({
      start: `${key}${this.subLevelSeparator}${sortKey}`,
      reverse: true,
      limit: 1
    }).asArray;

    if (result.length && result[0].key.startsWith(key)) {
      return this.joinedKeyResultToSortKeyCache(result[0]);
    }
    return null;
  }

  private async joinedKeyResultToSortKeyCache(joinedKeyResult: {
    key: string;
    value: ClientValueWrapper<V>;
  }): Promise<SortKeyCacheResult<V> | null> {
    const wrappedValue = joinedKeyResult.value;

    if (wrappedValue && wrappedValue.tomb === undefined && wrappedValue.value === undefined) {
      return new SortKeyCacheResult<V>(joinedKeyResult.key.split(this.subLevelSeparator)[1], wrappedValue as V);
    }

    if (wrappedValue && wrappedValue.tomb === false && wrappedValue.value != null) {
      return new SortKeyCacheResult<V>(joinedKeyResult.key.split(this.subLevelSeparator)[1], wrappedValue.value);
    }
    return null;
  }

  async put(cacheKey: CacheKey, value: V): Promise<void> {
    return this.db.childTransaction(() => {
      this.doPut(cacheKey, new ClientValueWrapper(value));
      this.removeOldestEntries(cacheKey);
    });
  }

  async del(cacheKey: CacheKey): Promise<void> {
    await this.doPut(cacheKey, new ClientValueWrapper(null, true));
  }

  private async doPut(cacheKey: CacheKey, value: ClientValueWrapper<V>): Promise<boolean> {
    const putResult = await this.db.put(this.dbEntryKey(cacheKey), value);
    if (putResult) {
      const previousCalls = this.rollbackBatch;
      const db = this.db;
      this.rollbackBatch = () => {
        db.removeSync(this.dbEntryKey(cacheKey));
        previousCalls();
      };
    }
    return putResult;
  }

  private dbEntryKey(cacheKey: CacheKey): string {
    return `${cacheKey.key}${this.subLevelSeparator}${cacheKey.sortKey}`;
  }

  private async removeOldestEntries(cacheKey: CacheKey) {
    // Get number of elements that is already in cache.
    // +1 to account for the element we just put and will be inserted with this transaction
    const numInCache =
      1 +
      this.db.getKeysCount({
        start: `${cacheKey.key}${this.subLevelSeparator}${genesisSortKey}`,
        end: this.dbEntryKey(cacheKey)
      });

    // Make sure there isn't too many entries for one contract
    if (numInCache <= this.lmdbOptions.maxEntriesPerContract) {
      // We're below the limit, finish
      return;
    }

    // Remove the oldest entries, so after the final put there's minEntriesPerContract present
    const numToRemove = numInCache - this.lmdbOptions.minEntriesPerContract;
    // Remove entries one by one, it's in a transaction so changes will be applied all at once
    this.db
      .getKeys({
        start: `${cacheKey.key}${this.subLevelSeparator}${genesisSortKey}`,
        limit: numToRemove
      })
      .forEach((key) => {
        this.db.remove(key);
      });
  }

  async delete(key: string): Promise<void> {
    return this.db.childTransaction(() => {
      this.doDelete(key);
    });
  }

  private async doDelete(key: string): Promise<void> {
    return this.db
      .getKeys({
        start: `${key}${this.subLevelSeparator}${genesisSortKey}`,
        end: `${key}${this.subLevelSeparator}${lastPossibleSortKey}`
      })
      .forEach((key) => {
        this.db.remove(key);
      });
  }

  open(): Promise<void> {
    if (this.db == null) {
      this.db = open<ClientValueWrapper<V>, string>({
        path: `${this.cacheOptions.dbLocation}`,
        noSync: this.cacheOptions.inMemory
      });
    }
    return;
  }

  async close(): Promise<void> {
    await this.db.close();
    this.db = null;
    return;
  }

  async dump(): Promise<any> {
    throw new Error('Not implemented yet');
  }

  async getLastSortKey(): Promise<string | null> {
    throw new Error('Not implemented yet');
  }

  async keys(sortKey: string, options?: SortKeyCacheRangeOptions): Promise<string[]> {
    return Array.from((await this.kvMap(sortKey, options)).keys());
  }

  storage<S>(): S {
    return this.db as S;
  }

  async prune(entriesStored = 1): Promise<PruneStats> {
    if (!entriesStored || entriesStored <= 0) {
      entriesStored = 1;
    }

    const statsBefore = await this.db.childTransaction(() => {
      const statsBefore: any = this.db.getStats();

      // Keys are ordered, so one particular contract is referred to by consecutive keys (one or more)
      let entryContractId = '';
      let entriesCounter = 0;
      this.db
        .getKeys({ end: null, reverse: true, snapshot: false })
        .filter((key) => {
          const [contractId] = key.split(this.subLevelSeparator, 1);
          if (contractId !== entryContractId) {
            // New entry
            entryContractId = contractId;
            entriesCounter = 0;
          }
          // Subsequent entry
          entriesCounter += 1;
          return entriesCounter > entriesStored;
        })
        .forEach((key) => {
          // Remove keys over the specified limit
          this.db.removeSync(key);
        });

      return statsBefore;
    });

    // All previous writes have been committed and fully flushed/synced to disk/storage
    await this.db.flushed;

    const statsAfter: any = this.db.getStats();

    return {
      entriesBefore: statsBefore.entryCount,
      sizeBefore: statsBefore.mapSize,
      entriesAfter: statsAfter.entryCount,
      sizeAfter: statsAfter.mapSize
    };
  }

  async begin(): Promise<void> {
    await this.checkPreviousTransactionFinished();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await this.db.put(this.ongoingTransactionMark, 'ongoing');
    const db = this.db;
    this.rollbackBatch = () => {
      return db.removeSync(this.ongoingTransactionMark);
    };
    return;
  }

  private async checkPreviousTransactionFinished() {
    const transactionMarkValue = (await this.db.get(this.ongoingTransactionMark)) as unknown as string;

    if (transactionMarkValue == 'ongoing') {
      throw new Error(`Database seems to be in inconsistent state. The previous transaction has not finished.`);
    }
  }

  async commit(): Promise<void> {
    this.db.removeSync(this.ongoingTransactionMark);
    this.rollbackBatch = () => {
      return;
    };
  }

  async kvMap(sortKey: string, options?: SortKeyCacheRangeOptions): Promise<Map<string, V>> {
    const rangeOptions: RangeOptions = {
      start: options?.reverse ? options?.lt : options?.gte,
      end: options?.reverse ? options?.gte : options?.lt,
      reverse: options?.reverse
    };

    const result: Map<string, V> = new Map();
    const rangedKeys = this.db.getKeys(rangeOptions).filter((k) => k != this.ongoingTransactionMark);
    for (const joinedKey of rangedKeys) {
      const clientKey = joinedKey.split(this.subLevelSeparator)[0];
      const wrappedValue = await this.getLessOrEqual(clientKey, sortKey);
      if (wrappedValue) {
        result.set(clientKey, (await this.getLessOrEqual(clientKey, sortKey)).cachedValue);
      }
    }

    if (options?.limit) {
      const limitedResult: Map<string, V> = new Map();
      for (const item of Array.from(result.entries()).slice(0, options.limit)) {
        limitedResult.set(item[0], item[1]);
      }
      return limitedResult;
    }

    return result;
  }

  async rollback(): Promise<void> {
    await this.db.transactionSync(this.rollbackBatch);
    this.rollbackBatch = () => {
      return;
    };
  }
}

class ClientValueWrapper<V> {
  constructor(readonly value: V, readonly tomb: boolean = false) {}
}
