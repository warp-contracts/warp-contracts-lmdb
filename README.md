# Warp Contracts Lmdb Cache
Warp Contracts implementation of the `SortKeyCache` using the [LMDB](https://github.com/kriszyp/lmdb-js#readme) database.
Compatible only with node env.

LMDB is a much better solution (than LevelDB) in terms of read/write access times and concurrency.  
Comparison by [Mozilla](https://mozilla.github.io/firefox-browser-architecture/text/0017-lmdb-vs-leveldb.html).


### Installation
Note: lmdb cache is compatible only with node.js env.

```
yarn add warp-contracts-lmdb
```

Requires `warp-contracts` SDK ver. min. 1.2.17
### Custom options
LmdbCache constructor accepts a second param with custom configuration.

| Option                | Required   | Description                                                                                                                           |
|-----------------------|------------|---------------------------------------------------------------------------------------------------------------------------------------|
| maxEntriesPerContract |   false    | Maximum number of interactions stored per contract id - above this threshold adding another entry triggers removing old interactions. |
| minEntriesPerContract |   false    | Minimum number of interactions stored per contract id. Value used when removing old iteractions.                                      |

### Usage

```js
const {defaultCacheOptions, WarpFactory} = require("warp-contracts");
const {LmdbCache} = require("warp-contracts-lmdb");

const warp = WarpFactory
  .forMainnet()
  .useStateCache(new LmdbCache({
      ...defaultCacheOptions,
      dbLocation: `./cache/warp/state`
    }, {
      maxEntriesPerContract: 100, 
      minEntriesPerContract: 10
    }
  ))
  .useContractCache(
    // Contract cache
    new LmdbCache({
    ...defaultCacheOptions,
    dbLocation: `./cache/warp/contracts`
    }), 
    // Source cache
    new LmdbCache({
    ...defaultCacheOptions,
    dbLocation: `./cache/warp/src`
  }));
```
