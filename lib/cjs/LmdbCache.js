"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LmdbCache = void 0;
const warp_contracts_1 = require("warp-contracts");
const lmdb_1 = require("lmdb");
class LmdbCache {
    constructor(cacheOptions, lmdbOptions) {
        this.lmdbOptions = lmdbOptions;
        this.logger = warp_contracts_1.LoggerFactory.INST.create('LmdbCache');
        if (!cacheOptions.dbLocation) {
            throw new Error('LmdbCache cache configuration error - no db location specified');
        }
        if (!lmdbOptions) {
            this.lmdbOptions = {
                maxEntriesPerContract: 10,
                minEntriesPerContract: 10
            };
        }
        this.logger.info(`Using location ${cacheOptions.dbLocation}`);
        this.db = (0, lmdb_1.open)({
            path: `${cacheOptions.dbLocation}`,
            noSync: cacheOptions.inMemory
        });
    }
    async get(contractTxId, sortKey, returnDeepCopy) {
        const result = this.db.get(`${contractTxId}|${sortKey}`) || null;
        if (result) {
            return {
                sortKey: sortKey,
                cachedValue: result
            };
        }
        else {
            return null;
        }
    }
    async getLast(contractTxId) {
        const result = this.db.getRange({ start: `${contractTxId}|${warp_contracts_1.lastPossibleKey}`, reverse: true, limit: 1 }).asArray;
        if (result.length) {
            if (!result[0].key.startsWith(contractTxId)) {
                return null;
            }
            return {
                sortKey: result[0].key.split('|')[1],
                cachedValue: result[0].value
            };
        }
        else {
            return null;
        }
    }
    async getLessOrEqual(contractTxId, sortKey) {
        const result = this.db.getRange({
            start: `${contractTxId}|${sortKey}`,
            reverse: true,
            limit: 1
        }).asArray;
        if (result.length) {
            if (!result[0].key.startsWith(contractTxId)) {
                return null;
            }
            return {
                sortKey: result[0].key.split('|')[1],
                cachedValue: result[0].value
            };
        }
        else {
            return null;
        }
    }
    async put(cacheKey, value) {
        await this.db.transaction(() => {
            this.db.put(`${cacheKey.contractTxId}|${cacheKey.sortKey}`, value);
            // Get number of elements that is already in cache.
            // +1 to account for the element we just put and will be inserted with this transaction
            const numInCache = 1 +
                this.db.getKeysCount({
                    start: `${cacheKey.contractTxId}|${warp_contracts_1.genesisSortKey}`,
                    end: `${cacheKey.contractTxId}|${cacheKey.sortKey}`
                });
            // Make sure there isn't too many entries for one contract
            if (numInCache <= this.lmdbOptions.maxEntriesPerContract) {
                // We're below the limit, finish
                return;
            }
            // Remove oldest entries, so after the final put there's minEntriesPerContract present
            const numToRemove = numInCache - this.lmdbOptions.minEntriesPerContract;
            // Remove entries one by one, it's in a transaction so changes will be applied all at once
            this.db
                .getKeys({
                start: `${cacheKey.contractTxId}|${warp_contracts_1.genesisSortKey}`,
                limit: numToRemove
            })
                .forEach((key) => {
                this.db.remove(key);
            });
        });
    }
    async delete(contractTxId) {
        await this.db.transaction(() => {
            this.db
                .getKeys({ start: `${contractTxId}|${warp_contracts_1.genesisSortKey}`, end: `${contractTxId}|${warp_contracts_1.lastPossibleKey}` })
                .forEach((key) => {
                this.db.remove(key);
            });
        });
    }
    close() {
        return this.db.close();
    }
    async dump() {
        throw new Error('Not implemented yet');
    }
    async getLastSortKey() {
        throw new Error('Not implemented yet');
    }
    async allContracts() {
        const keys = this.db.getKeys();
        const contracts = new Set();
        keys.forEach((k) => {
            contracts.add(k.split('|')[0]);
        });
        return Array.from(contracts);
    }
    storage() {
        return this.db;
    }
    async prune(entriesStored = 1) {
        if (!entriesStored || entriesStored <= 0) {
            entriesStored = 1;
        }
        const statsBefore = await this.db.transaction(() => {
            const statsBefore = this.db.getStats();
            // Keys are ordered, so one particular contract is referred to by consecutive keys (one or more)
            let entryContractId = '';
            let entriesCounter = 0;
            this.db
                .getKeys({ end: null, reverse: true, snapshot: false })
                .filter((key) => {
                const [contractId] = key.split('|', 1);
                if (contractId !== entryContractId) {
                    // New entry
                    entryContractId = contractId;
                    entriesCounter = 0;
                }
                // Subsequent entry
                entriesCounter += 1;
                return entriesCounter > entriesStored;
            })
                .forEach((key) => {
                // Remove keys over the specified limit
                this.db.removeSync(key);
            });
            return statsBefore;
        });
        // All previous writes have been committed and fully flushed/synced to disk/storage
        await this.db.flushed;
        const statsAfter = this.db.getStats();
        return {
            entriesBefore: statsBefore.entryCount,
            sizeBefore: statsBefore.mapSize,
            entriesAfter: statsAfter.entryCount,
            sizeAfter: statsAfter.mapSize
        };
    }
}
exports.LmdbCache = LmdbCache;
//# sourceMappingURL=LmdbCache.js.map