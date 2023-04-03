import * as fs from 'fs';
import { cache, getSortKey, rmCacheDB } from './utils';
import { promisify } from 'util';
import fastFolderSize from 'fast-folder-size';

const DB_NAME = 'cache-load';
const cacheSizes = [1, 100, 500, 1000, 3000, 5000, 10000, 30000, 50000, 70000, 100000];

const saveCacheSize = async (n: number, creation: number, access: number, deletion: number) => {
  const fastFolderSizeAsync = promisify(fastFolderSize);
  const size = (await fastFolderSizeAsync('./cache')) || 0;
  fs.appendFileSync(
    `./cachesize.csv`,
    `${n},${Math.round((size * 10) / 1024 / 1024) / 10},${creation},${access},${deletion}\n`,
    { flag: 'a' }
  );
};

jest.setTimeout(10000000);
describe.skip('Lmdb cache load tests', () => {
  beforeEach(() => {
    fs.rmSync('./cache', { force: true, recursive: true });
    fs.rmSync('./cachesize.csv', { force: true });
    fs.appendFileSync('./cachesize.csv', `Cache Size,MB,CreationMs,AccessMs,DeletionMs\n`, { flag: 'a' });
    fs.appendFileSync('./threshold.csv', `Min,Max,Delta,CacheSize,SizeMB,CreationMs\n`, { flag: 'a' });
  });

  afterEach(rmCacheDB(DB_NAME));

  it.skip('time to fill cache', async () => {
    for (let i = cacheSizes.length - 1; i >= 0; --i) {
      console.log('Testing cache size: ', i, cacheSizes[i]);
      fs.rmSync('./cache', { force: true, recursive: true });

      // Create the cache
      let start = new Date().getTime();
      const sut = await cache(DB_NAME, cacheSizes[i], 100, {
        maxEntriesPerContract: 15,
        minEntriesPerContract: 2
      });

      const creation = new Date().getTime() - start;

      const contracts = await sut.keys(getSortKey(100));

      // Access every element
      start = new Date().getTime();
      for (let i = 0; i < contracts.length; i++) {
        await sut.getLast(contracts[i]);
      }
      const access = new Date().getTime() - start;

      // Delete every element
      start = new Date().getTime();
      for (let i = 0; i < contracts.length; i++) {
        await sut.delete(contracts[i]);
      }
      const deletion = new Date().getTime() - start;

      await saveCacheSize(cacheSizes[i], creation, access, deletion);
    }
  });

  it('num entries per contract impact', async () => {
    const cacheSize = 1;
    const max = 10;
    for (let cacheSize = 1; cacheSize <= 10000; cacheSize += 500) {
      for (let min = 1; min <= max; min += 2) {
        console.log('Testing thresholds: ', min, cacheSize);
        fs.rmSync('./cache', { force: true, recursive: true });

        // Create the cache
        const start = new Date().getTime();
        const sut = await cache(DB_NAME, cacheSize, max * 3, {
          maxEntriesPerContract: max,
          minEntriesPerContract: min
        });

        const creation = new Date().getTime() - start;

        const fastFolderSizeAsync = promisify(fastFolderSize);
        const size = (await fastFolderSizeAsync('./cache')) || 0;
        fs.appendFileSync(
          `./threshold.csv`,
          `${min},${max},${max - min},${cacheSize},${Math.round((size * 10) / 1024 / 1024) / 10},${creation}\n`,
          { flag: 'a' }
        );
      }
    }
  });
});
