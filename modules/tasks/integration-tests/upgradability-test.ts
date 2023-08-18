// A complex integration task with a goal to proceed upgradability checks after commit to a protected branch.
// It deploys implementations, updates them in update manager and proceeds upgradability tests for kernels specified.
// ref to schema: https://miro.com/app/board/uXjVOyZCMKs=/ todo: to notion + more info + readme + tricks
import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import "@nomiclabs/hardhat-ethers"
import { readFilterUpdateManagers } from "@scripts/core/read-from-file-filtered"
import { ChainIds } from "@constants/networks"
import { getImpersonatedSignerWithEths } from "@scripts/hardhat/impersonateAccountWithEths"
import { fundHardhatAccount } from "@scripts/hardhat/fundAccount"
import { Environment } from "@scripts/interfaces/environment"
import { checkStage } from "@utils/scripts/checkStage"
import { spreadingBoolean, spreadingValue } from "@utils/synSugar"
import { getAppsToTest } from "@utils/tasks/upgradabilityTests"

interface TaskArguments {
    file: string
    appsToTrack: string
    updateManagersFile: string // todo: deprecate -> to 1 update manager
    remoteFetch: boolean
    forceApps: boolean
    batchSize: number
    protocolFile: string
    noDeploy: boolean
    forceUpdate: boolean
    migrateToBeacon: boolean
}

task(
    "upgradability-test",
    "A complex integration task with a goal to proceed upgradability " +
        "checks after commit to a protected branch. It deploys implementations, updates them in update manager" +
        " and proceeds upgradability tests for kernels specified"
)
    .addParam(
        "updateManagersFile", // todo: deprecate -> to 1 update manager
        "Address of Update Manager contract to which newly deployed implementations will be added"
    )
    .addOptionalParam(
        "file",
        "JSON file with kernel addresses with format, e.g. " +
            '[{"contractAddress" : "0xAb9f24AcF3987412898e28b31CEc6a4Daee21D8E"}]'
    )
    .addOptionalParam(
        "protocolFile",
        'JSON file with contract addresses, e.g. [{"contractAddress" : "0xAb9f24AcF3987412898e28b31CEc6a4Daee21D8E", "app" : "UPDATE_MANAGER"}]'
    )
    .addOptionalParam("appsToTrack", "AppsIds to be tracked on byte code changed via hardhat-deploy, e.g. KERNEL,ADMIN")
    .addFlag("remoteFetch", "Specify if you want to fetch kernels from the remote. File param would not be used.")
    .addFlag("forceApps", "If selected, all apps would be deployed and upgraded")
    .addParam("batchSize", "Specify batch size to batch kernels passed", "100")
    .addFlag("noDeploy", "Whether to deploy new implementaions")
    .addFlag("forceUpdate", "Force update")
    .addFlag("migrateToBeacon", "Migrate all kernels to support UpgradableBeacon")
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        if (!args?.noDeploy && !process.env.FORKING_MODE_USE_SOURCE_DEPLOYMENTS) {
            throw Error("FORKING_MODE_USE_SOURCE_DEPLOYMENTS is not specified")
        }

        const { chainId } = await hre.ethers.provider.getNetwork()

        if (chainId === Number(ChainIds.hardhat)) {
            await fundHardhatAccount(hre, (await hre.ethers.getSigners())[0].address, "100")
            await getImpersonatedSignerWithEths(hre.ethers, "0x22bdc4AA7204f59d78d38d82729bE76CA4e6E4Df")
        }

        const appsToTest = await getAppsToTest(hre, !!args?.noDeploy, args?.appsToTrack || [], !!args?.forceApps)

        const env = checkStage(hre) ? Environment.STAGE : Environment.MAINNET
        const updateManagerAddresses = readFilterUpdateManagers(env, args?.updateManagersFile)

        if (!args?.noDeploy) {
            console.log(`New ${appsToTest} were deployed according to hardhat-deploy task`)
        }

        if (args?.appsToTrack) {
            console.log("forceApps flag was specified, using all apps for testing")
        }

        if (appsToTest.length === 0 && !args?.noDeploy && !args?.forceUpdate) {
            console.log(
                `No updated apps in list supplied: ${appsToTest} according to hardhat-deploy task.` +
                    " Thus, this task is completed"
            )
            return
        }

        console.log(
            "Run add-to-updatemanager." +
                `Thus, update implementation addresses in ${updateManagerAddresses} for ${appsToTest}`
        )
        await hre.run("add-to-updatemanager", {
            ums: updateManagerAddresses.join(","),
            apps: appsToTest.join(","),
            noDeploy: true,
        })

        console.log(`Run integration-tests-getters-upgradability for apps ${appsToTest}`)

        const optionalParams = {
            ...spreadingBoolean(!!args?.remoteFetch, "remoteFetch"),
            ...spreadingBoolean(!!args?.migrateToBeacon, "migrateToBeacon"),
        }

        await hre.run("getters-upgradability", {
            file: args.file,
            apps: appsToTest.join(","),
            batchSize: args.batchSize,
            ums: args.updateManagersFile,
            protocolFile: args?.protocolFile || "",
            ...optionalParams,
        })

        if (args?.migrateToBeacon) {
            await hre.run("migrate-to-beacon", {
                ...spreadingValue(args?.file, "file"),
                ...spreadingValue(args?.batchSize, "batchSize"),
                ...spreadingBoolean(!!args?.remoteFetch, "remoteFetch"),
                ums: updateManagerAddresses.join(","),
            })
        }
    })
