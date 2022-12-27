import { CacheKey, CacheOptions, SortKeyCache, SortKeyCacheResult, PruneStats } from 'warp-contracts';
import { LmdbOptions } from './LmdbOptions';
export declare class LmdbCache<V = any> implements SortKeyCache<V> {
    private readonly lmdbOptions?;
    private readonly logger;
    private readonly db;
    constructor(cacheOptions: CacheOptions, lmdbOptions?: LmdbOptions);
    get(contractTxId: string, sortKey: string, returnDeepCopy?: boolean): Promise<SortKeyCacheResult<V> | null>;
    getLast(contractTxId: string): Promise<SortKeyCacheResult<V> | null>;
    getLessOrEqual(contractTxId: string, sortKey: string): Promise<SortKeyCacheResult<V> | null>;
    put(cacheKey: CacheKey, value: V): Promise<void>;
    delete(contractTxId: string): Promise<void>;
    close(): Promise<void>;
    dump(): Promise<any>;
    getLastSortKey(): Promise<string | null>;
    allContracts(): Promise<string[]>;
    storage<S>(): S;
    prune(entriesStored?: number): Promise<PruneStats>;
}
//# sourceMappingURL=LmdbCache.d.ts.map