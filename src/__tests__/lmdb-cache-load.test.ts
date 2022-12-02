import * as fs from 'fs';
import { cache, getContractId, getSortKey } from './utils'
import { promisify } from 'util'
import fastFolderSize from 'fast-folder-size'

const cacheSizes = [1, 100, 500, 1000, 3000, 5000, 10000, 30000, 50000, 70000, 100000]

const saveCacheSize = async (n: number, creation: number, access: number, deletion: number) => {
  const fastFolderSizeAsync = promisify(fastFolderSize)
  const size = await fastFolderSizeAsync('./cache') || 0
  fs.appendFileSync(`./cachesize.csv`, `${n},${Math.round(size * 10 / 1024 / 1024) / 10},${creation},${access},${deletion}\n`, { flag: "a" })
}

jest.setTimeout(10000000)
describe.skip('Lmdb cache load tests', () => {
  beforeEach(() => {
    fs.rmSync('./cache', { force: true, recursive: true });
    fs.rmSync('./cachesize.csv', { force: true });
    fs.appendFileSync("./cachesize.csv", `Cache Size,MB,CreationMs,AccessMs,DeletionMs\n`, { flag: "a" })
  });

  afterEach(() => {
    fs.rmSync('./cache', { force: true, recursive: true });
  });

  it('time to fill cache', async () => {
    for (let i = cacheSizes.length - 1; i >= 0; --i) {
      console.log("Testing cache size: ", i, cacheSizes[i])
      fs.rmSync('./cache', { force: true, recursive: true });

      // Create the cache
      let start = new Date().getTime();
      const sut = await cache(cacheSizes[i], 1);
      const creation = new Date().getTime() - start;

      const contracts = await sut.allContracts()

      // Access every element
      start = new Date().getTime();
      for (let i = 0; i < contracts.length; i++) {
        await sut.getLast(contracts[i])
      }
      const access = new Date().getTime() - start;


      // Delete every element
      start = new Date().getTime();
      for (let i = 0; i < contracts.length; i++) {
        await sut.delete(contracts[i])
      }
      const deletion = new Date().getTime() - start;

      await saveCacheSize(cacheSizes[i], creation, access, deletion)
    }
  });
});
