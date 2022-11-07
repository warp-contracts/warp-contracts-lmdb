# Warp Contracts Lmdb Cache
Warp Contracts implementation of the `SortKeyCache` using the LMDB database.
Compatible only in node env.

### Usage

```js
const warp = WarpFactory
  .custom(arweave, cacheOptions, 'mainnet', new LmdbCache({
    ...cacheOptions,
    dbLocation: `./cache/warp/lmdb-2/contracts`
  }))
  .useWarpGateway(defaultWarpGwOptions, defaultCacheOptions,)
  .build();
```
