import * as fs from 'fs';
import { BatchDBOp, CacheKey } from 'warp-contracts';
import { cache, delBatch, getContractId, getSortKey, putBatch } from './utils';

describe('Lmdb cache batch', () => {
  beforeEach(() => {
    fs.rmSync('./cache', { force: true, recursive: true });
  });

  afterEach(() => {
    fs.rmSync('./cache', { force: true, recursive: true });
  });

  it('multiple operations', async () => {
    const sut = await cache(1, 1);

    const batches: BatchDBOp<any>[] = [];
    batches.push(
      putBatch('contract11', getSortKey(111), 'Result11'),
      delBatch('contract12'),
      putBatch('contract12', getSortKey(111), 'Result12'),
      putBatch('contract13', getSortKey(111), 'Result13'),
      putBatch('contract11', getSortKey(111), 'Result1111'),
      delBatch('contract13'),
      delBatch(getContractId(0))
    );

    expect(await sut.get(new CacheKey(getContractId(0), getSortKey(0)))).toBeTruthy();
    expect(await sut.get(new CacheKey('contract11', getSortKey(111)))).toBeFalsy();
    expect(await sut.get(new CacheKey('contract12', getSortKey(111)))).toBeFalsy();

    await sut.batch(batches);

    expect(await sut.get(new CacheKey(getContractId(0), getSortKey(0)))).toBeFalsy();
    expect((await sut.get(new CacheKey('contract11', getSortKey(111)))).cachedValue).toMatch('Result1111');
    expect((await sut.get(new CacheKey('contract12', getSortKey(111)))).cachedValue).toMatch('Result12');
    expect(await sut.get(new CacheKey('contract13', getSortKey(111)))).toBeFalsy();
  });
});
