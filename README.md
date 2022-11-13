# Warp Contracts Lmdb Cache
Warp Contracts implementation of the `SortKeyCache` using the LMDB database.
Compatible only in node env.

### Installation
Note: lmdb cache is compatible only with node.js env.

```
yarn add warp-contracts-lmdb
```

Requires `warp-contracts` SDK ver. min. 1.2.17

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
