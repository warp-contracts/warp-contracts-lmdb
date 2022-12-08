/* eslint-disable */
import { LmdbCache } from '../src/LmdbCache'
import { RootDatabase } from 'lmdb';
import { defaultCacheOptions, CacheKey } from 'warp-contracts';

const commandLineArgs = require('command-line-args')
const cliProgress = require('cli-progress');

process.on('uncaughtException', (error: any) => {
  console.error(`Uncaught exception: ${error}`);
  if (error.stack)
    console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (error: any) => {
  console.error(`Promise rejection: ${error}`);
  if (error.stack)
    console.error(error.stack);
  process.exit(1);

});

const optionDefinitions = [
  { name: 'input', type: String, alias: 'i' },
  { name: 'output', type: String, alias: 'o' },
]

async function main() {
  const args = commandLineArgs(optionDefinitions)
  if (args.input === args.output) {
    console.error("Input and output folders can't be the same")
    return
  }

  console.log('Rewriting LMDB cache to another LMDB cache');

  const input = new LmdbCache<any>({ ...defaultCacheOptions, dbLocation: args.input })
    .storage<RootDatabase<any, string>>();
  const output = new LmdbCache<any>({ ...defaultCacheOptions, dbLocation: args.output })
    .storage<RootDatabase<any, string>>();

  const bar = new cliProgress.SingleBar({
    etaBuffer: 1000,
  }, cliProgress.Presets.shades_classic);
  bar.start(input.getKeysCount(), 0);

  input.transactionSync(() => {
    input.getRange({ snapshot: false })
      .forEach(({ key, value }) => {
        try {
          output.putSync(key, value)
        } catch (err) {
          console.log("Failed to insert value", key, "exception: ", err)
        }
        bar.increment()
      });
  })

  bar.stop()
}

main().catch((e) => console.error(e));
