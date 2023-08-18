# **DAO blockchain OS by Superdao (Superdao OS)**
_Superdao is an all-in-one platform to start, manage and grow DAOs. A substantial part of our product is Superdao OS — a smart contract framework to build and run organizations on the blockchain._

## Resources
- Article about Superdao OS ["Superdao OS — Operating System for DAOs"](https://medium.com/superdao-blog/superdao-os-operating-system-for-daos-3140a5a42e8f)
- Article about Superdao OS ["How Superdao covers users’ gas fees"](https://medium.com/superdao-blog/meet-the-callforwarder-e513bf7e8714)
- User interface of Superdao OS ["Superdao Product Demo"](https://youtu.be/3kQ1-UPp2VM)
- Security Audit of Superdao OS ["Superdao OS Security Analysis by Pessimistic"](https://github.com/pessimistic-io/audits/blob/main/Superdao%20Security%20Analysis%20by%20Pessimistic.pdf)

## Core contributors
We are posting a repository with no commit history, so here is a list of developers who contributed.
- Ivan Kalashnikov
- [Aleksandr Davydov](https://github.com/axdvdv)
- [Artyom Zinovyev](https://github.com/don2quixote)
- [Elshan Dzhafarov](https://github.com/elshan-eth)
- Ivan Cheprasov
- Ivan Kalashnikov
- Max Averin
- [Mikhail Sitnikov](https://github.com/MihanixA)
- [Vladimir Alefman](https://github.com/alefmanvladimir)
- [Vladislav Semkin](https://github.com/vasemkin)

# Contents
- [Repo Structure](#repo-structure)
- [Develop](#develop)
- [Network](#network)
- [Live Network](#live-network)
  - [Mainnet](#mainnet)
  - [Testnet](#testnet)
  - [Hardhat](#hardhat)
  - [Fork](#fork)
    - [Hardhat Fork](#hardhat-fork)
    - [Tenderly Fork](#tenderly-fork)
- [Deploy](#deploy)
  - [Testnet](#testnet-1)
  - [Localhost](#localhost)
    - [Add local network to Metamask](#add-local-network-to-metamask)
  - [Fork](#fork-1)
- [Hardhat Task](#hardhat-task)
  - [Upgrade scripts with UpdateManager](#upgrade-scripts-with-updatemanager)
  - [Upgrade scripts bypassing UpdateManager](#upgrade-scripts-bypassing-updatemanager)
  - [Automatically upgrade applications in DAOs from file](#automatically-upgrade-applications-in-daos-from-file)
  - [Integration Test](#integration-test)
    - [Upgradability Getters Test](#upgradability-getters-test)
    - [Deploy Update Upgrade Test](#deploy-update-upgrade-test)
- [FAQ](#faq)

# Repo structure

- `contracts/`: `.sol` files of our contract logic
- `deployments/`
- `modules/deploy/`
- `modules/helpers/`
- `modules/scripts/`: suppose to be a core folder for TS modules to be used either in tasks/ or in scripts/ itself.
To run scripts itself it is supposed that you use `ts-node` instead of `node` (coz we write in typescript).
- `modules/tasks/`: hardhat tasks for manual run. Note, that in hradhat tasks can not use typechain-types of our contracts coz of hardhat environmental logic.
- `packages/`: now it consists of logic to copy artifacts & typechain-types of our contracts and deploy to NPM
- `modules/tests/`
  (this logic used to triggered by [.gitlab-ci.yml](.gitlab-ci.yml))
  
# Develop

- Install project dependencies

```bash
pnpm i
```

- Install husky

```bash
pnpm prepare
```

- Compile contracts

```bash
pnpm i
```

- Generate typechain-types

```bash
pnpm typechain
```

# Network

This repo is designed to use several networks. **How to use** each of network in the repo and **what envs** to supply to `.env`
is described below.

Note, that we distinguished **mainnet** and **testnet** and do not apply abstraction
to those networks.

# Live Network

To use live network (e.g. polygon, mumbai) supply personal key and rpc to the related network (personal key is used by
todo: related to #97 MR) and in all tasks, scripts where hardhat engine is used apply
`--network mainnet` or `--network testnet` accordingly.

## Mainnet

```
MAINNET_DEPLOYER_PK
MAINNET_RPC
```

## Testnet

```
TESTNET_DEPLOYER_PK
TESTNET_RPC
```

## Hardhat

Hardhat network is designed to be used as it is and without providing any env. Such network is used for unittesting and
by default when no `--network` flag is provided.

## Fork

### Hardhat Fork

Fork might be used for, e.g. test if contracts will be upgraded without errors and etc. Every script/tasks those
are run under hardhat engine could be running under fork via hardhat. To make hardhat run scripts and tasks under
fork of mainnet or testnet `.env` with next:

```dotenv
MAINNET_RPC
FORKING_MODE=MAINNET
FORKING_FROM_BLOCK
```

or

````dotenv
```dotenv
TESTNET_RPC
FORKING_MODE=TESTNET
FORKING_FROM_BLOCK
````

> **no** additional flag of `--network` is required

### Tenderly Fork

Currently, only [tasks/integration-tests/getters-upgradability.ts](tasks/integration-tests/getters-upgradability.ts) as
a hardhat task supports possibility to be run on Tenderly fork. Use-case e.g. to prepare public network rpc with
upgraded contracts to be tested.

To use tenderly fulfil following in `.env`:

```dotenv
TENDERLY_PROJECT_ID
TENDERLY_USERNAME
TENDERLY_ACCESS_KEY
```

> **no** additional flag of `--network` is required

# Deploy

On deploy we use **hardhat-deploy** plugin that do next:

- checks if contract should be deployed (if contract code is changed)
- write new abi, address, etc in [deployments/](deployments/) to the folder with name of network used.

## Testnet

Deploy to Polygon Mumbai (testnet):

```bash
pnpm deploy:testnet
```

Verify deployment:

```bash
pnpm hardhat --network testnet etherscan-verify
```

## Localhost

- Run local node

```bash
pnpm chain
```

- In other console deploy on that network

```bash
pnpm deploy:localhost
```

### Add local network to Metamask

- Just add a new network and set `http://localhost:8545` as RPC URL

## Fork

Use-case e.g. we want to use feature of new code of contract checking of **hardhat-deploy** plugin and to sync
hardhat-deploy tasks and custom tasks by deployment folder.

How to use fork network but work with deployment/<ur network> folder, - together with .env to make fork use

```dotenv
FORKING_MODE_USE_SOURCE_DEPLOYMENTS=true
```

with this setup **hardhat-deploy** plugin will work with `deployments/<specified network name>`
instead of `deployments/hardhat`.

> Careful: you may rewrite `deployment/mainnet` and push it to the git (but those deployed contracts will be
> only on you fork)

# Hardhat Task

todo: @IvanKalashnikov: describe logic of 1,2,3 and mv scripts to a new folder...

## Feature

- hardhat tasks could not use typechain types of our contracts (but general TS scripts could use it)
- when reading from file in some tasks there is filtration logic under the hood.
  Check [scripts/core/read-from-file-filtered.ts](scripts/core/read-from-file-filtered.ts)

## Upgrade scripts with UpdateManager

- Add newest impl to UpdateManager

```bash
pnpm hardhat manager-add-impl --appId {APP_ID} --kernel {KERNEL_ADDRESS} --impl {IMPL_ADDRESS}
```

- Upgrade app to the last implementation

```bash
pnpm hardhat manager-upgrade-app --appId {APP_ID} --kernel {KERNEL_ADDRESS}
```

This script is interactive. If you choose to search for the implementation,
make sure your kernel is on the newest impl that supports `upgradeAppImpl()` function.
To upgrade the kernel to the right version, run the script without looking for impls,
it will upgrade the kernel to the lastest version in the UpdateManager.

## Upgrade scripts bypassing UpdateManager

Make sure your kernel version supports `upgradeAppImpl()`.
Update it with the method above.

- Upgrade app to the last implementation

```bash
pnpm hardhat upgrade-impl --appId {APP_ID} --kernel {KERNEL_ADDRESS} --impl {IMPL_ADDRESS}
```

## Automatically upgrade applications in DAOs from file

DAOs specified in the file should exist, so it is supposed you will use a fork. You may run upgrades on fork, mainnet
or even on tenderly fork (to get public RPC url with upgraded contracts at the end).

- Upgrade apps in kernels from file (to do upgrade on Tenderly fork add `--on-tenderly-fork`)

```bash
pnpm hardhat upgrade-from-file --file {PATH} --apps {APP_ID1},{APP_ID2}
```

Json file format:

```json
[
  {
    "contractAddress": "0x553C2c81596b32D86697D115eEdA1184bBD8E661"
  }
]
```

## Integration Test

The tests and scripts in [tasks/integration-tests](tasks/integration-tests) are designed to be run on forked network via
hardhat engine. Thus, to run such tasks manually firstly pay attention to the [Fork](#fork) section.

### Upgradability Getters Test

Test that application implementations behave the same way after upgrade on the hardhat network fork.

Features:

- currently, it supports getters tests for next apps: KERNEL, ERC721, ADMIN_CONTROLLER, OPEN_SALE
- no needs to test apps those are not even connected to kernel we check. Thus, it checks that an app connected

To run integration test on upgrade action, firstly, update env with params to fork todo: prepare json and then run
task itself:

```bash
echo "[{\"contractAddress\" : \"0xAb9f24AcF3987412898e28b31CEc6a4Daee21D8E\"}]" > tasks/contractsToTest.json
pnpm hardhat getters-upgradability --file tasks/contractsToTest.json --apps ERC721,KERNEL
```

### Deploy Update Upgrade Test

A complex integration task with a goal to proceed upgradability checks after commit to a protected branch.
It

- deploys implementations via hardhat-deploy plugin,
- updates them in update managers for managers specified in a file,
- proceed upgradability tests [Upgradability Getters Test](#upgradability-getters-test) for kernels specified in a file.

Thus, pay attention to the section [Fork](#fork-1) and note that supplied update manager should be synced
with the kernels supplied. Otherwise, this pipeline has not meaning for kernels with different update managers.

ref to https://miro.com/app/board/uXjVOiYgA80=/

E.g. to prepare files & run:

```bash
echo "[{\"contractAddress\" : \"0xBC2B53801FE03D7A8f9992a36DdEf596Bb6dc3c6\"}]" > tasks/inputs/contractsToTest.json
echo "[{\"contractAddress\" : \"0xDeB6b06E22A5BdFB2d42000074B46F9C2c3861FE\"}]" > tasks/inputs/updateManagersToUpd.json
pnpm hardhat integration-test-deploy-update-upgrade --file tasks/inputs/contractsToTest.json \\
--apps-to-track KERNEL,ADMIN --update-managers-file tasks/inputs/updateManagersToUpd.json
```

# FAQ

- I didn't modify anything though I get `VM Exception while processing transaction: revert Initializable: contract is already initialized` (or similar) when attempting to deploy contracts

Restart ganache-cli. Most likely already deployed and initialized contracts are begin re-initialized.

- Where do I find contract addresses?

All deployment data stored to `deploy/deployments/loalhost` at your $cwd.

# Example DAO powered by Superdao OS (Epic Web3 DAO)
## Links
- [Epic Web3 twitter](https://app.superdao.co/epicweb3)
- [NFT collection on Opensea](https://opensea.io/collection/hey-growth-v2)

## Contracts
- [Kernel](https://polygonscan.com/address/0x4eae47c596594293e8d22dec44a0bcb1d935a947)
- [Sudo](https://polygonscan.com/address/0x736337020906E52ef43542e183eb6f385423d8FE)
- [Admin](https://polygonscan.com/address/0x27D411d5bf7c829c94f9BDaeD1aF998539E28D01)
- [ERC721](https://polygonscan.com/address/0xfA3D84B542E9Dc071F347DcbD43d9C4983538c1d)
- [ERC721 Link Claim](https://polygonscan.com/address/0x0000000000000000000000000000000000000000)
- [Sales Controller](https://polygonscan.com/address/0xCe268FBe950E8A301FDD6E97c979EbD4D511d5d3)
- [Open sale](https://polygonscan.com/address/0x58AF5f304a89bacFab92186268bB02339e57bdE5)
- Private sale
- [Kernel Implementation](https://polygonscan.com/address/0xe060b71B946D88932238bfcdF5b124388A6Bf843)
- [ERC721 Properties Implementation](https://polygonscan.com/address/0x6092F6161C01F53c8077Cd5a63F0E05dADf60e1A)
- [Admin Implementation](https://polygonscan.com/address/0x5D9412894aCD8E657c9760dA83368219465bdD06)
- [Open Sale Implementation](https://polygonscan.com/address/0xf949770455175D44E26eB6637b8ed398F2337113)
- Private Sale Implementation
- [Treasury (Gnosis Safe)](https://polygonscan.com/address/0x1922d5e6A3ab2B15979C328fe16cecba0A17c4E9)