import { LmdbCache } from '../LmdbCache';
import { LmdbOptions } from '../LmdbOptions';
import { DelBatch, PutBatch } from 'warp-contracts';
import fs from 'fs';

export const getContractId = (i: number) => `contract${i}`.padStart(43, '0');

export const getSortKey = (j: number) =>
  `${j.toString().padStart(12, '0')},1643210931796,81e1bea09d3262ee36ce8cfdbbb2ce3feb18a717c3020c47d206cb8ecb43b767`;

export const putBatch = <V>(putKey: string, putSortKey: string, resultVal: V): PutBatch<V> => ({
  type: 'put',
  key: { key: putKey, sortKey: putSortKey },
  value: resultVal
});

export const delBatch = (delKey: string): DelBatch => ({
  type: 'del',
  key: delKey
});

export const rmCacheDB = function (dbName: string): () => any {
  return () => {
    if (fs.existsSync(`./cache/warp/${dbName}`)) {
      fs.rmSync(`./cache/warp/${dbName}`, { recursive: true });
    }
  };
};

export const cache = async function (
  dbName: string,
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
  const sut = new LmdbCache<any>({ dbLocation: `./cache/warp/${dbName}`, inMemory: true }, lmdbOptions);

  for (let i = 0; i < numContracts; i++) {
    for (let j = 0; j < numRepeatingEntries; j++) {
      await sut.put(
        {
          key: getContractId(i),
          sortKey: getSortKey(j)
        },
        { result: `contract${i}:${j}` }
      );
    }
  }

  return sut;
};
