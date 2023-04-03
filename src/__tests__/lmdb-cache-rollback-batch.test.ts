import { CacheKey, SortKeyCache } from 'warp-contracts';
import { cache, getSortKey, rmCacheDB } from './utils';

const DB_NAME = 'cache-batch';

describe('Lmdb cache batch', () => {
  let sut: SortKeyCache<unknown>;

  beforeAll(async () => {
    sut = await cache(DB_NAME, 1, 1);
  });

  afterAll(rmCacheDB(DB_NAME));

  it('access range keys during active transaction and commit', async () => {
    const sortKey = 343;

    await sut.begin();
    await sut.put(new CacheKey('key.one', getSortKey(sortKey)), 1);
    await sut.put(new CacheKey('key.two', getSortKey(sortKey)), 2);

    const transactionKeys = await sut.keys(getSortKey(sortKey));
    expect(transactionKeys).toContain('key.one');
    expect(transactionKeys).toContain('key.two');

    const kvKeys = Array.from((await sut.kvMap(getSortKey(sortKey), { gte: 'key.', lt: 'key.\xff' })).keys());
    expect(kvKeys).toContain('key.one');
    expect(kvKeys).toContain('key.two');

    await sut.commit();

    expect((await sut.getLast('key.one')).cachedValue).toEqual(1);
    expect((await sut.getLast('key.three'))?.cachedValue).toBeFalsy();
  });

  it('keys order natural and reversed', async () => {
    const sortKey = 348;

    await sut.begin();

    await sut.put(new CacheKey('user.11', getSortKey(sortKey)), 2);
    await sut.put(new CacheKey('user.12', getSortKey(sortKey)), 2);
    await sut.put(new CacheKey('user.13', getSortKey(sortKey)), 2);
    await sut.put(new CacheKey('user.14', getSortKey(sortKey)), 2);
    await sut.put(new CacheKey('user.15', getSortKey(sortKey)), 2);

    const naturalOrder = Array.from((await sut.kvMap(getSortKey(sortKey), { gte: 'user.11', lt: 'user.14' })).keys());
    const reverseOrder = Array.from(
      (await sut.kvMap(getSortKey(sortKey), { gte: 'user.11', lt: 'user.14', reverse: true })).keys()
    );
    expect(naturalOrder.reverse()).toEqual(reverseOrder);

    await sut.commit();

    await sut.begin();
    await sut.del(new CacheKey('user.12', getSortKey(sortKey)));

    const items = Array.from(
      (await sut.kvMap(getSortKey(sortKey), { gte: 'user.11', lt: 'user.14', reverse: true })).keys()
    );
    expect(items).toEqual(['user.13', 'user.11']);

    await sut.commit();
  });

  it('access range keys during active transaction and rollback', async () => {
    const sortKey = 384;

    await sut.begin();
    await sut.put(new CacheKey('key.one', getSortKey(sortKey)), 11);
    await sut.put(new CacheKey('key.three', getSortKey(sortKey)), 3);
    await sut.del(new CacheKey('key.two', getSortKey(sortKey)));

    const transactionKeys = await sut.keys(getSortKey(sortKey));
    expect(transactionKeys).toContain('key.one');
    expect(transactionKeys).toContain('key.three');

    const kvKeys = Array.from((await sut.kvMap(getSortKey(sortKey), { gte: 'key.', lt: 'key.\xff' })).keys());
    expect(kvKeys).toContain('key.one');
    expect(kvKeys).toContain('key.three');

    expect((await sut.getLast('key.one')).cachedValue).toEqual(11);
    expect((await sut.getLast('key.two'))?.cachedValue).toBeFalsy();
    expect((await sut.getLast('key.three')).cachedValue).toEqual(3);

    await sut.rollback();

    expect((await sut.getLast('key.one')).cachedValue).toEqual(1);
    expect((await sut.getLast('key.two')).cachedValue).toEqual(2);
    expect((await sut.getLast('key.three'))?.cachedValue).toBeFalsy();
  });

  it('multiple operations', async () => {
    const sortKey = 395;

    await sut.begin();
    await sut.put(new CacheKey('key.one', getSortKey(sortKey)), 111);
    await sut.put(new CacheKey('key.two', getSortKey(sortKey)), 222);
    await sut.put(new CacheKey('key.four', getSortKey(sortKey)), 333);
    await sut.put(new CacheKey('key.five', getSortKey(sortKey)), 333);

    await sut.del(new CacheKey('key.two', getSortKey(sortKey)));
    await sut.del(new CacheKey('key.fa', getSortKey(sortKey)));

    const transactionKeys = await sut.keys(getSortKey(sortKey));
    expect(transactionKeys).toContain('key.one');
    expect(transactionKeys).toContain('key.four');

    const kvKeys = Array.from((await sut.kvMap(getSortKey(sortKey), { gte: 'key.', lt: 'key.\xff', limit: 2 })).keys());
    expect(kvKeys).toEqual(['key.five', 'key.four']);

    await sut.rollback();

    const rollbackKeys = Array.from(
      (await sut.kvMap(getSortKey(sortKey), { gte: 'key.', lt: 'key.\xff', reverse: true })).keys()
    );
    expect(rollbackKeys).toEqual(['key.two', 'key.one']);
  });
});
