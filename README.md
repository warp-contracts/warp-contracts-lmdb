# Warp Distributed Execution Network
Warp DEN is a network of nodes that performs an execution of registered SmartWeave contracts.
The consensus between the nodes is achieved via [Snowball Loop algorithm](https://ipfs.io/ipfs/QmUy4jh5mGNZvLkjies1RWM4YuvJh5o2FYopNPVYwrRVGV) (page 4., Figure 3.).

- [Installation](#installation)
- [Running node - Docker](#running-node---docker)
- [Endpoints](#endpoints)
- [DEN Contract](#den-contract)
- [Licensing](#licensing)

### Installation

1. `yarn install`
2. `yarn build`

### Running node - Docker
DEN docker images are deployed to [dockerhub](https://hub.docker.com/r/warpredstone/den/tags).
In order to run node locally:
1. create a folder (e.g. `.secrets`) with `wallet.json` file inside - Arweave JSON Web Key (JWK)
2. create a folder that will store the sqlite database file (e.g. `.db`)

To start the node, run the following command:
```bash
docker run -t -d -p <host_port>:<container_port> \
-v <path_to_db_dir>:/app/dist/.db \
-v <path_to_jwk_dir>:/app/dist/.secrets warpredstone/den:<version> \
--url='<public_address>' --port=<container_port> --testnet='<is_testnet>' \
--networkId='<network_id>' --networkContractId='<network_contract_id>'
```

where:

1. `host_port` - TCP port on the Docker host
2. `container_port` - TCP port in the Docker container - the port the node is listening for the requests, e.g. `8080`.
4. `path_to_jwk_dir` - path to a folder where `wallet.json` file is stored (e.g. `.secrets`)
5. `version` - DEN docker image version (e.g. `1.0.8`). Check latest available version on [dockerhub](https://hub.docker.com/r/warpredstone/den/tags).
6. `public_address` - node's public address, e.g.: `http://138.197.7.53`
8. `is_testnet` - whether network is working in a public RedStone [testnet](https://testnet.redstone.tools/)
or Arweave mainnet
9. `network_id` - DEN id, e.g. `redstone_network`
10. `network_contract_id` - contract tx id that this network is registered in (e.g. `FxjoXsxQyuknaqaCV2Si7sq0TF3taBb8uTRmXmC6FQs` - [SonAR](https://sonar.redstone.tools/#/app/contract/FxjoXsxQyuknaqaCV2Si7sq0TF3taBb8uTRmXmC6FQs#))

Full example: 
```bash
docker run -t -d -p 8080:8080 \
-v /home/den/.db:/app/dist/.db \
-v /home/den/.secrets:/app/dist/.secrets warpredstone/den:1.0.8 \
--url="http://134.209.84.136" --port=8080 --testnet='false' \
--networkId='redstone_network' --networkContractId='FxjoXsxQyuknaqaCV2Si7sq0TF3taBb8uTRmXmC6FQs'
```

### Endpoints
1. `/ehlo`
```
http://<public_address>:<host_port>/ehlo
```

e.g. [http://134.209.84.136:8080/ehlo](http://134.209.84.136:8080/ehlo)

This endpoint returns some basic info about a node:
* the DEN contract, that it is using (e.g. `FxjoXsxQyuknaqaCV2Si7sq0TF3taBb8uTRmXmC6FQs`)
* the network, that the node is connected to (e.g. `redstone_network`)
* the contracts, that are evaluated by this network 
* the list of other nodes connected to network 
* current Snowball consensus params 
* node's address, wallet address, etc.

2. `/state`
```
http://<public_address>:<host_port>/state?id=<contract_id>
```

e.g. [http://134.209.84.136:8080/state?id=KT45jaf8n9UwgkEareWxPgLJk4oMWpI5NODgYVIF1fY](http://134.209.84.136:8080/state?id=KT45jaf8n9UwgkEareWxPgLJk4oMWpI5NODgYVIF1fY)

This endpoint returns the current state of the contract of id passed in the `id` query params and some additional data from
the Snowball rounds (all the responses from all the nodes that took part in a given round). 
Each response from the node contains its signature. 
  
In order to verify the signature of a given node
1. Compute a `deepHash` of `[stateHash, signature.owner]`, e.g.:
```ts
const sigData = await deepHash([
    arweave.utils.stringToBuffer(data.hash),
    arweave.utils.stringToBuffer(data.signature.owner)
]);
```

2. Verify the signature:
```ts
const verified = await arweave.crypto.verify(
    data.signature.owner,
    sigData,
    data.signature.sig
);
```

This endpoint also returns info about the network height, at which the state was evaluated, the last evaluated transaction id
and amount of evaluated interactions.

3. `/state` with validity:
```
http://<public_address>:<host_port>/state?id=<contract_id>&validity=true
```

Same as in point 2., but also returns validity. This might affect response times for contracts with
several thousands of interactions.

e.g. [http://134.209.84.136:8080/state?id=pvudp_Wp8NMDJR6KUsQbzJJ27oLO4fAKXsnVQn86JbU](http://134.209.84.136:8080/state?id=pvudp_Wp8NMDJR6KUsQbzJJ27oLO4fAKXsnVQn86JbU)

4. `/state` without Snowball
```
http://<public_address>:<host_port>/state?id=<contract_id>&snowball=false
```

This allows to get the state evaluated by a given node, without running the Snowball.
Should be used only if you fully trust given node.

e.g. [http://134.209.84.136:8080/state?id=pvudp_Wp8NMDJR6KUsQbzJJ27oLO4fAKXsnVQn86JbU&snowball=false](http://134.209.84.136:8080/state?id=pvudp_Wp8NMDJR6KUsQbzJJ27oLO4fAKXsnVQn86JbU&snowball=false)

### DEN Contract
All DENs are registered within a SmartWeave contract (at the time of writing the contract id is [FxjoXsxQyuknaqaCV2Si7sq0TF3taBb8uTRmXmC6FQs](https://sonar.redstone.tools/#/app/contract/FxjoXsxQyuknaqaCV2Si7sq0TF3taBb8uTRmXmC6FQs#)).

The contract gives an option to register/unregister contracts (by the given DEN operator), register nodes, change network's consensus params, etc.

In the future the staking/slashing features will be added.


### Licensing
The primary license for RedStone Distributed Execution Network Node is the Business Source License 1.1 (BUSL-1.1), see [LICENSE](https://github.com/redstone-finance/redstone-sw-node/blob/main/LICENSE)
