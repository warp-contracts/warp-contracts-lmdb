import { LmdbCache } from '../LmdbCache';
import { LmdbOptions } from '../LmdbOptions';
import { defaultCacheOptions } from 'warp-contracts';

export const getContractId = (i: number) => `contract${i}`.padStart(43, '0');

export const getSortKey = (j: number) =>
  `${j.toString().padStart(12, '0')},1643210931796,81e1bea09d3262ee36ce8cfdbbb2ce3feb18a717c3020c47d206cb8ecb43b767`;

export const cache = async function (
  numContracts: number,
  numRepeatingEntries: number,
  opt?: LmdbOptions
): Promise<LmdbCache<any>> {
  const lmdbOptions: LmdbOptions = opt
    ? opt
    : {
        maxEntriesPerContract: 100 * numRepeatingEntries,
        minEntriesPerContract: 100 * numRepeatingEntries
      };
  const sut = new LmdbCache<any>({ ...defaultCacheOptions, inMemory: true }, lmdbOptions);

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
