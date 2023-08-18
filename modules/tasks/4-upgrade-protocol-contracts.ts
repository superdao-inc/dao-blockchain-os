import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import "@nomiclabs/hardhat-ethers"
import { Engine } from "@scripts/interfaces/engine"
import { ChainIds } from "@constants/networks"
import { TenderlyFork } from "@scripts/clients/tenderly/tenderlyFork"
import { TenderlySimulator } from "@scripts/clients/tenderly/tenderlySimulator"
import { getImpersonatedSignerWithEths } from "@scripts/hardhat/impersonateAccountWithEths"
import { filterProtocolContracts } from "@utils/filterApps"
import { readProtocolMetasFromFile } from "@utils/scripts/file"
import { upgradeProtocolContracts } from "@scripts/core/upgrade-protocol-contracts"
import { promises } from "fs"

type ProtocolUpgradeArgs = {
    file: string
    onTenderlyFork: boolean
    failedContractsToFile: boolean
}

task("upgrade-protocol-contracts", "Upgrading protocol contracts from file")
    .addParam(
        "file",
        'JSON file with contract addresses, e.g. [{"contractAddress" : "0xAb9f24AcF3987412898e28b31CEc6a4Daee21D8E", "app" : "UPDATE_MANAGER"}]',
        "[]"
    )
    .addFlag(
        "onTenderlyFork",
        "Specify if you would prefer tenderly fork rather than hardhat env (tenderly envs should exist in .env)"
    )
    .addFlag("failedContractsToFile", "Specify if you want to get failed contracts to be reported with errors")
    .setAction(async (args: ProtocolUpgradeArgs, hre: HardhatRuntimeEnvironment) => {
        const { releaseManager } = await hre.getNamedAccounts()

        const contractMetas = await readProtocolMetasFromFile(args.file)
        const contracts = filterProtocolContracts(contractMetas)

        let engine: Engine
        if (args.onTenderlyFork) {
            const fork = new TenderlyFork(ChainIds.mainnet)
            await fork.create()
            const tenderlySimulator = new TenderlySimulator({ rpc: fork.rpcUrl })
            engine = { simulator: tenderlySimulator }
        } else {
            engine = { hreEthers: hre.ethers, deployments: hre.deployments }
            const { chainId } = await engine.hreEthers.provider.getNetwork()

            if (chainId === Number(ChainIds.hardhat)) {
                await getImpersonatedSignerWithEths(engine.hreEthers, releaseManager)
            }
        }

        console.log(`Upgrading ${contracts.length} contracts...`)
        const errors = await upgradeProtocolContracts(contracts, releaseManager, engine, false)

        if (errors.length > 0 && !!args?.failedContractsToFile) {
            await promises.writeFile(
                "./tasks/reports/errors.upgrade.protocol-contracts.json",
                JSON.stringify(errors, null, 4)
            )
            console.log("Wrote failed contracts to file")
        }
        console.log(`Success`)
    })
