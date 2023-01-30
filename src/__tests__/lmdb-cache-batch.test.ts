import { BatchDBOp, CacheKey } from 'warp-contracts';
import { cache, delBatch, getContractId, getSortKey, putBatch, rmCacheDB } from './utils';

const DB_NAME = 'cache-batch';

describe('Lmdb cache batch', () => {
  beforeEach(rmCacheDB(DB_NAME));
  afterEach(rmCacheDB(DB_NAME));

  it('multiple operations', async () => {
    const sut = await cache(DB_NAME, 1, 1);

    const batches: BatchDBOp<any>[] = [];
    batches.push(
      putBatch('contract11', getSortKey(111), 'Result11'),
      delBatch('contract12'),
      putBatch('contract12', getSortKey(111), 'Result12'),
      putBatch('contract13', getSortKey(111), 'Result13'),
      putBatch('contract13', getSortKey(112), 'Result13'),
      putBatch('contract11', getSortKey(111), 'Result1111'),
      putBatch('contract11', getSortKey(112), 'Result1112'),
      delBatch('contract13'),
      delBatch(getContractId(0))
    );

    expect(await sut.get(new CacheKey(getContractId(0), getSortKey(0)))).toBeTruthy();
    expect(await sut.get(new CacheKey('contract11', getSortKey(111)))).toBeFalsy();
    expect(await sut.get(new CacheKey('contract11', getSortKey(112)))).toBeFalsy();
    expect(await sut.get(new CacheKey('contract12', getSortKey(111)))).toBeFalsy();

    await sut.batch(batches);

    expect(await sut.get(new CacheKey(getContractId(0), getSortKey(0)))).toBeFalsy();
    expect((await sut.get(new CacheKey('contract11', getSortKey(111)))).cachedValue).toMatch('Result1111');
    expect((await sut.get(new CacheKey('contract11', getSortKey(112)))).cachedValue).toMatch('Result1112');
    expect((await sut.get(new CacheKey('contract12', getSortKey(111)))).cachedValue).toMatch('Result12');
    expect(await sut.get(new CacheKey('contract13', getSortKey(111)))).toBeFalsy();
    expect(await sut.get(new CacheKey('contract13', getSortKey(112)))).toBeFalsy();
  });
});
