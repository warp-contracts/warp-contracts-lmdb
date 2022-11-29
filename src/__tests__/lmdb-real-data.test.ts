import { LmdbCache } from '../LmdbCache';
import { defaultCacheOptions, PruneStats } from 'warp-contracts';

describe.skip('Prune real Lmdb cache. Copy the real cache to ./cache, unskip and run npm run test:real', () => {
  test('handle real data', async () => {
    const sut = new LmdbCache<any>({ ...defaultCacheOptions, inMemory: true });
    const stats = await sut.prune(1);
    console.log('Stats:', stats);
  });
});
