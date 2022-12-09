/* eslint-disable */
import { LmdbCache } from '../src/LmdbCache'
import { RootDatabase } from 'lmdb';
import { defaultCacheOptions, CacheKey } from 'warp-contracts';
import {
  LoggerFactory,
} from 'warp-contracts';
import * as fs from 'fs';

const commandLineArgs = require('command-line-args')

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
  { name: 'startChunk', type: Number, alias: 's' },
  { name: 'numChunks', type: Number, alias: 'c' },
]

async function main() {
  const args = commandLineArgs(optionDefinitions)
  if (args.input === args.output) {
    console.error("Input and output folders can't be the same")
    return
  }

  LoggerFactory.INST.logLevel('error');

  const input = new LmdbCache<any>({ ...defaultCacheOptions, dbLocation: args.input })
    .storage<RootDatabase<any, string>>();

  const output = new LmdbCache<any>({ ...defaultCacheOptions, dbLocation: args.output })
    .storage<RootDatabase<any, string>>();

  const numKeys = input.getKeysCount()
  const chunkSize = 1000

  const endChunk = Math.min(Math.ceil(numKeys / chunkSize), args.startChunk + args.numChunks)

  let counter = 0
  let i
  for (i = args.startChunk; i < endChunk; i++) {
    try {
      output.transactionSync(() => {
        // input.getKeys({ snapshot: false, limit: chunkSize, offset: i * chunkSize })
        //   .forEach((key) => {
        //     console.log(key)
        //     let value = input.getBinary(key)
        //     fs.writeFileSync("./problem.bin", value)
        //     console.log(value)
        //   });
        input.getRange({ snapshot: false, limit: chunkSize, offset: i * chunkSize })
          .forEach(({ key, value }) => {
            try {
              output.putSync(key, value)
            } catch (err) {
              console.error("Failed to put", key, "exception:", err)
            }
            counter += 1
          });
      })

      await output.flushed

    } catch (err) {
      console.error("Failed to chunk, exception:", i, err)
      process.exit(1)
    }
  }
  i -= 1
  console.log("Inserted elements ", i * chunkSize + counter, "of", numKeys, "(", Math.floor((100 * i * chunkSize + counter) / numKeys), "%)")
  if (counter !== 0) {
    // Tell the running script there's still data
    process.exit(12)
  }

  await input.close()
  await output.close()

  process.exit(0)
}

main().catch((e) => console.error(e));
