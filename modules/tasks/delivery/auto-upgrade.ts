import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import "@nomiclabs/hardhat-ethers"
import { readFilterUpdateManagers } from "@scripts/core/read-from-file-filtered"
import { Environment } from "@scripts/interfaces/environment"
import { checkStage } from "@utils/scripts/checkStage"
import { spreadingBoolean, spreadingValue } from "@utils/synSugar"
import { ChainIds } from "@constants/networks"
import { fundHardhatAccount } from "@scripts/hardhat/fundAccount"
import { getAppsToTest } from "@utils/tasks/upgradabilityTests"
import { AppsIds } from "@utils/const"

type FullScaleUpgradeArgs = {
    apps: string
    file: string
    failedKernelsToFile?: boolean
    batchSize?: string
    remoteFetch?: boolean
    updateManagersFile: string
    protocolFile?: string
    updateProtocolApps: boolean
    onTenderlyFork: boolean
    isStage: boolean
    noDeploy: boolean
    migrateToBeacon: boolean
    forceApps: boolean
    // omitBatchForKernel?: boolean
    callForwarderAddress?: string
    noBatch: boolean
}

task("auto-upgrade", "Upgrades all kernels in a CD job")
    .addOptionalParam(
        "file",
        'JSON file to kernel addresses with format, e.g. [{"contractAddress" : "0xAb9f24AcF3987412898e28b31CEc6a4Daee21D8E"}]'
    )
    .addOptionalParam("apps", "AppsIds to update, e.g. KERNEL,SUDO", "")
    .addOptionalParam(
        "protocolFile",
        'JSON file with contract addresses, e.g. [{"contractAddress" : "0xAb9f24AcF3987412898e28b31CEc6a4Daee21D8E", "app" : "UPDATE_MANAGER"}]',
        "[]"
    )
    .addFlag(
        "onTenderlyFork",
        "Specify if you would prefer tenderly fork rather than hardhat env (tenderly envs should exist in .env)"
    )
    .addFlag("failedKernelsToFile", "Specify if you want to get failed kernels to be reported with errors")
    .addFlag("remoteFetch", "Specify if you want to fetch kernels from the remote")
    .addFlag("updateProtocolApps", "Whether protocol apps should be updated.")
    .addOptionalParam("batchSize", "Specify the batch size", "200")
    .addParam(
        "updateManagersFile",
        "Address of Update Manager contract to which newly deployed implementations will be added"
    )
    .addFlag("noDeploy", "Disable deployments")
    .addFlag("forceApps", "Force apps")
    .addFlag("migrateToBeacon", "Migrate all kernels to support UpgradableBeacon")
    // .addFlag("omitBatchForKernel", "When we deploy new CallForwarder instance, upgrades won't work on Kernel contract")
    .addOptionalParam(
        "callForwarderAddress",
        "If we deploy a new instance of callForwarder, we can update DAOs through the old one"
    )
    .addFlag("noBatch", "whether to use CallForwarder's batchCall")
    .setAction(async (args: FullScaleUpgradeArgs, hre: HardhatRuntimeEnvironment) => {
        if (args?.updateProtocolApps && !args?.protocolFile) {
            console.log("Protocol address file was not specified, shutting down.")
            return
        }

        const env = checkStage(hre) ? Environment.STAGE : Environment.MAINNET
        const { chainId } = await hre.ethers.provider.getNetwork()

        if (chainId === Number(ChainIds.hardhat)) {
            await fundHardhatAccount(hre, (await hre.ethers.getSigners())[0].address, "100")
        }

        console.log("Adding new implementations to UpdateManager...")
        const updateManagerAddresses = readFilterUpdateManagers(env, args.updateManagersFile)

        if (args?.updateProtocolApps) {
            if (!args?.noDeploy) {
                console.log("Deploying protocol contracts...")
                await hre.run("deploy-protocol-contracts")
            }
        }

        const appsToUpdate = await getAppsToTest(hre, !!args?.noDeploy, args?.apps || [], !!args?.forceApps)
        if (!args?.noDeploy) {
            console.log(
                "Running add-to-updatemanager." +
                    `Thus, update implementation addresses in ${updateManagerAddresses} for ${appsToUpdate}`
            )

            await hre.run("add-to-updatemanager", {
                ums: updateManagerAddresses.join(","),
                apps: appsToUpdate.join(","),
                noDeploy: true,
            })
        }

        if (args?.updateProtocolApps) {
            console.log("Running protocol contract upgrade script")
            await hre.run("upgrade-protocol-contracts", { file: args.protocolFile })
        }

        if (args?.migrateToBeacon) {
            await hre.run("deploy-beacons", { ums: updateManagerAddresses.join(",") })
        }

        console.log("Running the upgrade script")

        // add flags
        const optionalParams = {
            ...spreadingBoolean(!!args?.remoteFetch, "remoteFetch"),
            ...spreadingBoolean(!!args?.noBatch, "noBatch"),
            ...spreadingBoolean(!!args?.failedKernelsToFile, "failedKernelsToFile"),
            ...spreadingBoolean(!!args?.onTenderlyFork, "onTenderlyFork"),
            // ...spreadingBoolean(!!args?.omitBatchForKernel, "omitBatchForKernel"),
            ...spreadingValue(args?.callForwarderAddress, "callForwarderAddress"),
        }

        await hre.run("upgrade-from-file", {
            apps: appsToUpdate.join(","),
            batchSize: args?.batchSize || 200,
            file: args.file,
            ...optionalParams,
        })

        if (args?.migrateToBeacon) {
            await hre.run("migrate-to-beacon", {
                ...spreadingValue(args?.file, "file"),
                ...spreadingValue(args?.batchSize, "batchSize"),
                ...spreadingBoolean(!!args?.noBatch, "noBatch"),
                ...spreadingBoolean(!!args?.remoteFetch, "remoteFetch"),
                ums: updateManagerAddresses.join(","),
            })
        }

        if (chainId !== Number(ChainIds.hardhat)) {
            // verify the new contracts
            await hre.run("etherscan-verify")
        }
    })
