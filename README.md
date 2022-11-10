# Warp Contracts Lmdb Cache
Warp Contracts implementation of the `SortKeyCache` using the LMDB database.
Compatible only in node env.

### Usage

```js
const warp = WarpFactory
  .forMainnet()
  .useStateCache(new LmdbCache({
      ...defaultCacheOptions,
      dbLocation: `./cache/warp/state`
    }
  ))
  .useContractCache(new LmdbCache({
    ...defaultCacheOptions,
    dbLocation: `./cache/warp/contracts`
  }));
```
