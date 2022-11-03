import {
  CacheKey,
  CacheOptions,
  lastPossibleKey,
  LoggerFactory,
  SortKeyCache,
  SortKeyCacheResult
} from 'warp-contracts';
import { RootDatabase, open } from 'lmdb';

export class LmdbCache<V = unknown> implements SortKeyCache<V> {
  private readonly logger = LoggerFactory.INST.create('LmdbCache');

  private readonly db: RootDatabase<V, string>;

  constructor(cacheOptions: CacheOptions) {
    if (!cacheOptions.dbLocation) {
      throw new Error('LmdbCache cache configuration error - no db location specified');
    }
    this.logger.info(`Using location ${cacheOptions.dbLocation}/state`);
    this.db = open<V, string>({
      path: `${cacheOptions.dbLocation}/state`,
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
    throw new Error('Not implemented yet');
  }
}
