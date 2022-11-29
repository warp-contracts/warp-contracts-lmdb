/* eslint-disable */
import { LevelDbCache, defaultCacheOptions, CacheKey } from 'warp-contracts';
import { LmdbCache } from '../src/LmdbCache'
import { RootDatabase } from 'lmdb';

async function main() {
  console.log('Copy LMDB cache to LevelDB');
  const src = new LmdbCache<any>({ ...defaultCacheOptions, dbLocation: "./src" });
  const dst = new LevelDbCache<any>({ ...defaultCacheOptions, dbLocation: "./dst" })

  const entries = new Array<{ key: CacheKey; value: any }>();
  src.storage<RootDatabase<any, string>>().getRange({ reverse: true, snapshot: false })
    .forEach(({ key, value }) => {
      const [contractTxId, sortKey] = key.split('|', 2);
      entries.push({
        key: new CacheKey(contractTxId, sortKey),
        value
      });
    });

  for (let i = 0; i < entries.length; i++) {
    console.log("PUT ", ++i, entries[i].key)
    await dst.put(entries[i].key, entries[i].value);
  }

  await dst.prune(1)
}

main().catch((e) => console.error(e));
