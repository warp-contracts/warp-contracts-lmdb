import { LmdbCache } from '../LmdbCache';
import { defaultCacheOptions, PruneStats } from 'warp-contracts';
import * as fs from 'fs';

const getContractId = (i: number) => `contract${i}`.padStart(43, '0');
const getSortKey = (j: number) =>
  `${j.toString().padStart(12, '0')},1643210931796,81e1bea09d3262ee36ce8cfdbbb2ce3feb18a717c3020c47d206cb8ecb43b767`;

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
        await sut.put(
          {
            contractTxId: getContractId(i),
            sortKey: getSortKey(j)
          },
          { result: `contract${i}:${j}` }
        );
      }
    }

    return sut;
  };

  it('handle improper args', async () => {
    const contracts = 10;
    const entriesPerContract = 1;
    const sut = await cache(contracts, entriesPerContract);

    const noopStats = { entriesAfter: contracts, entriesBefore: contracts };
    expect(await sut.prune(0)).toMatchObject(noopStats);
    expect(await sut.prune(-1)).toMatchObject(noopStats);
  });

  it('no deletion should be performed', async () => {
    const contracts = 10;
    const entriesPerContract = 1;
    const sut = await cache(contracts, entriesPerContract);

    const noopStats = { entriesAfter: contracts, entriesBefore: contracts };
    expect(await sut.prune(1)).toMatchObject(noopStats);
    expect(await sut.prune(10)).toMatchObject(noopStats);
    expect(await sut.prune(contracts)).toMatchObject(noopStats);
    expect(await sut.prune(-1 * contracts)).toMatchObject(noopStats);
    expect(await sut.prune(contracts)).toMatchObject(noopStats);
    expect(await sut.prune(2 * contracts)).toMatchObject(noopStats);
  });

  it('should remove all unneeded entries, one contract', async () => {
    const contracts = 1;
    const entriesPerContract = 10;
    const sut = await cache(contracts, entriesPerContract);
    expect(await sut.prune(1)).toMatchObject({
      entriesBefore: contracts * entriesPerContract,
      entriesAfter: contracts * 1
    });
  });

  it('should remove all unneeded entries, in many contracts', async () => {
    const contracts = 200;
    const entriesPerContract = 10;
    const sut = await cache(contracts, entriesPerContract);
    expect(await sut.prune(2)).toMatchObject({
      entriesBefore: contracts * entriesPerContract,
      entriesAfter: contracts * 2
    });
  });

  it('should remove oldest entries, in many contracts', async () => {
    const contracts = 100;
    const entriesPerContract = 20;
    const toLeave = 3;
    const sut = await cache(contracts, entriesPerContract);
    await sut.prune(toLeave);

    for (let i = 0; i < contracts; i++) {
      // Check newest elements are present
      for (let j = 0; j < toLeave; j++) {
        expect(await sut.get(getContractId(i), getSortKey(entriesPerContract - j - 1))).toBeTruthy();
      }

      // Check old elements are removed
      for (let j = toLeave; j < entriesPerContract; j++) {
        expect(await sut.get(getContractId(i), getSortKey(entriesPerContract - j - 1))).toBeFalsy();
      }
    }
  });

  it('deletes first contract from cache', async () => {
    const contracts = 7
    const entriesPerContract = 12
    const sut = await cache(contracts, entriesPerContract)

    await sut.delete(getContractId(0))

    // Removed elements
    for (let j = 0; j < entriesPerContract; j++) {
      expect(await sut.get(getContractId(0), getSortKey(j))).toBeFalsy()
    }

    // Remaining elements
    for (let i = 1; i < contracts; i++) {
      for (let j = 0; j < entriesPerContract; j++) {
        expect(await sut.get(getContractId(i), getSortKey(j))).toBeTruthy()
      }
    }

    expect((await sut.allContracts()).length).toBe(contracts - 1)
  });

  it('deletes contract from the middle of the cache', async () => {
    const contracts = 7
    const entriesPerContract = 12
    const removedContractIdx = 3
    const sut = await cache(contracts, entriesPerContract)

    await sut.delete(getContractId(removedContractIdx))

    // Remaining elements
    for (let i = 0; i < contracts; i++) {
      for (let j = 0; j < entriesPerContract; j++) {
        const data = await sut.get(getContractId(i), getSortKey(j))
        if (i === removedContractIdx) {
          expect(data).toBeFalsy()
        } else {
          expect(data).toBeTruthy()
        }
      }
    }

    expect((await sut.allContracts()).length).toBe(contracts - 1)
  });
});
