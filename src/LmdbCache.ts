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
import { RootDatabase, open } from 'lmdb';
import { LmdbOptions } from './LmdbOptions';

export class LmdbCache<V = any> implements SortKeyCache<V> {
  private readonly logger = LoggerFactory.INST.create('LmdbCache');

  private db: RootDatabase<V, string>;

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
    this.db = open<V, string>({
      path: `${cacheOptions.dbLocation}`,
      noSync: cacheOptions.inMemory
    });
  }

  /**
   * Batch operations are all executed in one transaction using childTransaction.
   * For each put there is an old entries removal run.
   */
  async batch(opStack: BatchDBOp<V>[]) {
    await this.db.childTransaction(async () => {
      for (const op of opStack) {
        if (op.type === 'put') {
          await this.doPut(op.key, op.value);
          await this.removeOldestEntries(op.key);
        } else if (op.type === 'del') {
          await this.doDelete(op.key);
        }
      }
    });
  }

  async get(cacheKey: CacheKey, returnDeepCopy?: boolean): Promise<SortKeyCacheResult<V> | null> {
    const result = this.db.get(`${cacheKey.key}|${cacheKey.sortKey}`) || null;

    if (result) {
      return {
        sortKey: cacheKey.sortKey,
        cachedValue: result
      };
    } else {
      return null;
    }
  }

  async getLast(key: string): Promise<SortKeyCacheResult<V> | null> {
    const result = this.db.getRange({ start: `${key}|${lastPossibleSortKey}`, reverse: true, limit: 1 }).asArray;
    if (result.length) {
      if (!result[0].key.startsWith(key)) {
        return null;
      }
      return {
        sortKey: result[0].key.split('|')[1],
        cachedValue: result[0].value
      };
    } else {
      return null;
    }
  }

  async getLessOrEqual(key: string, sortKey: string): Promise<SortKeyCacheResult<V> | null> {
    const result = this.db.getRange({
      start: `${key}|${sortKey}`,
      reverse: true,
      limit: 1
    }).asArray;
    if (result.length) {
      if (!result[0].key.startsWith(key)) {
        return null;
      }
      return {
        sortKey: result[0].key.split('|')[1],
        cachedValue: result[0].value
      };
    } else {
      return null;
    }
  }

  async put(cacheKey: CacheKey, value: V): Promise<void> {
    return this.db.childTransaction(() => {
      this.doPut(cacheKey, value);
      this.removeOldestEntries(cacheKey);
    });
  }

  private async doPut(cacheKey: CacheKey, value: V): Promise<boolean> {
    return this.db.put(`${cacheKey.key}|${cacheKey.sortKey}`, value);
  }

  private async removeOldestEntries(cacheKey: CacheKey) {
    // Get number of elements that is already in cache.
    // +1 to account for the element we just put and will be inserted with this transaction
    const numInCache =
      1 +
      this.db.getKeysCount({
        start: `${cacheKey.key}|${genesisSortKey}`,
        end: `${cacheKey.key}|${cacheKey.sortKey}`
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
        start: `${cacheKey.key}|${genesisSortKey}`,
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
      .getKeys({ start: `${key}|${genesisSortKey}`, end: `${key}|${lastPossibleSortKey}` })
      .forEach((key) => {
        this.db.remove(key);
      });
  }

  open(): Promise<void> {
    if (this.db == null) {
      this.db = open<V, string>({
        path: `${this.cacheOptions.dbLocation}`,
        noSync: this.cacheOptions.inMemory
      });
    }
    return;
  }

  close(): Promise<void> {
    this.db.close();
    this.db = null;
    return;
  }

  async dump(): Promise<any> {
    throw new Error('Not implemented yet');
  }

  async getLastSortKey(): Promise<string | null> {
    throw new Error('Not implemented yet');
  }

  async keys(): Promise<string[]> {
    const keys = this.db.getKeys();
    const contracts = new Set<string>();
    keys.forEach((k) => {
      contracts.add(k.split('|')[0]);
    });

    return Array.from(contracts);
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
          const [contractId] = key.split('|', 1);
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
}
