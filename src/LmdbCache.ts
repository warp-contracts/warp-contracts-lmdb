import {
  CacheKey,
  CacheOptions,
  lastPossibleKey,
  genesisSortKey,
  LoggerFactory,
  SortKeyCache,
  SortKeyCacheResult,
  PruneStats
} from 'warp-contracts';
import { RootDatabase, open } from 'lmdb';

export class LmdbCache<V = any> implements SortKeyCache<V> {
  private readonly logger = LoggerFactory.INST.create('LmdbCache');

  private readonly db: RootDatabase<V, string>;

  constructor(cacheOptions: CacheOptions) {
    if (!cacheOptions.dbLocation) {
      throw new Error('LmdbCache cache configuration error - no db location specified');
    }
    this.logger.info(`Using location ${cacheOptions.dbLocation}`);
    this.db = open<V, string>({
      path: `${cacheOptions.dbLocation}`,
      noSync: cacheOptions.inMemory
    });
  }

  async get(contractTxId: string, sortKey: string, returnDeepCopy?: boolean): Promise<SortKeyCacheResult<V> | null> {
    const result = this.db.get(`${contractTxId}|${sortKey}`) || null;

    if (result) {
      return {
        sortKey: sortKey,
        cachedValue: result
      };
    } else {
      return null;
    }
  }

  async getLast(contractTxId: string): Promise<SortKeyCacheResult<V> | null> {
    const result = this.db.getRange({ start: `${contractTxId}|${lastPossibleKey}`, reverse: true, limit: 1 }).asArray;
    if (result.length) {
      if (!result[0].key.startsWith(contractTxId)) {
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

  async getLessOrEqual(contractTxId: string, sortKey: string): Promise<SortKeyCacheResult<V> | null> {
    const result = this.db.getRange({
      start: `${contractTxId}|${sortKey}`,
      reverse: true,
      limit: 1
    }).asArray;
    if (result.length) {
      if (!result[0].key.startsWith(contractTxId)) {
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

  async put(stateCacheKey: CacheKey, value: V): Promise<void> {
    await this.db.put(`${stateCacheKey.contractTxId}|${stateCacheKey.sortKey}`, value);
  }

  async delete(contractTxId: string): Promise<void> {
    await this.db.transaction(() => {
      this.db
        .getKeys({ start: `${contractTxId}|${genesisSortKey}`, end: `${contractTxId}|${lastPossibleKey}` })
        .forEach((key) => {
          this.db.removeSync(key);
        });
    });
  }

  close(): Promise<void> {
    return this.db.close();
  }

  async dump(): Promise<any> {
    throw new Error('Not implemented yet');
  }

  async getLastSortKey(): Promise<string | null> {
    throw new Error('Not implemented yet');
  }

  async allContracts(): Promise<string[]> {
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

    const statsBefore = await this.db.transaction(() => {
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
