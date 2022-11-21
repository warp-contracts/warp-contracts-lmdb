import { LmdbCache } from '../LmdbCache';
import { defaultCacheOptions, PruneStats } from 'warp-contracts';
import * as fs from 'fs';

describe('Lmdb cache prune', () => {
  beforeEach(() => {
    fs.rmSync('./cache', { force: true, recursive: true });
  });

  afterEach(() => {
    fs.rmSync('./cache', { force: true, recursive: true });
  });

  const cache = async function (numContracts: number, numRepeatingEntries: number): Promise<LmdbCache<any>> {
    const sut = new LmdbCache<any>({ ...defaultCacheOptions, inMemory: true });


    for (let i = 0; i < numContracts; i++) {
      for (let j = 0; j < numRepeatingEntries; j++) {
        // console.log("Added", i, j)
        await sut.put(
          {
            contractTxId: `contract${i}`,
            sortKey: `${j},1643210931796,81e1bea09d3262ee36ce8cfdbbb2ce3feb18a717c3020c47d206cb8ecb43b767`
          },
          { result: `contract${i}:${j}` }
        )
      }
    }

    return sut
  }

  it('handle improper args', async () => {
    const contracts = 10
    const entriesPerContract = 1
    const sut = await cache(contracts, entriesPerContract)

    const noopStats = { entriesAfter: contracts, entriesBefore: contracts }
    expect(await sut.prune(0)).toMatchObject(noopStats)
    expect(await sut.prune(-1)).toMatchObject(noopStats)
  });

  it('no deletion should be performed', async () => {
    const contracts = 10
    const entriesPerContract = 1
    const sut = await cache(contracts, entriesPerContract)

    const noopStats = { entriesAfter: contracts, entriesBefore: contracts }
    expect(await sut.prune(1)).toMatchObject(noopStats)
    expect(await sut.prune(10)).toMatchObject(noopStats)
    expect(await sut.prune(contracts)).toMatchObject(noopStats)
    expect(await sut.prune(-1 * contracts)).toMatchObject(noopStats)
    expect(await sut.prune(contracts)).toMatchObject(noopStats)
    expect(await sut.prune(2 * contracts)).toMatchObject(noopStats)
  });

  it('should remove all unneeded entries, one contract', async () => {
    const contracts = 1
    const entriesPerContract = 10
    const sut = await cache(contracts, entriesPerContract)
    expect(await sut.prune(1)).toMatchObject({ entriesBefore: contracts * entriesPerContract, entriesAfter: contracts * 1 })
  });

  it('should remove all unneeded entries, in many contracts', async () => {
    const contracts = 200
    const entriesPerContract = 10
    const sut = await cache(contracts, entriesPerContract)
    expect(await sut.prune(2)).toMatchObject({ entriesBefore: contracts * entriesPerContract, entriesAfter: contracts * 2 })
  });

});
