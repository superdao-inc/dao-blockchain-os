import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import "@nomiclabs/hardhat-ethers"
import { promises } from "fs"
import { upgradeAppImpls as upgradeNoBatch } from "@scripts/core/upgrade-apps-impls"
import { upgradeAppImpls as upgradeWithBatch } from "@scripts/core/upgrade-apps-impls-batch"
import { TenderlySimulator } from "@scripts/clients/tenderly/tenderlySimulator"
import { TenderlyFork } from "@scripts/clients/tenderly/tenderlyFork"
import { ChainIds } from "@constants/networks"
import { Engine } from "@scripts/interfaces/engine"
import { getImpersonatedSignerWithEths } from "@scripts/hardhat/impersonateAccountWithEths"
import { batchCall } from "@utils/scripts/batch-call"
import { filterApps } from "@utils/filterApps"
import { Environment } from "@scripts/interfaces/environment"
import { checkStage } from "@utils/scripts/checkStage"
import { conditionalKernels } from "@utils/tasks/upgradabilityTests"
import { AppsIds } from "@constants/appsIds"
import cliProgress from "cli-progress"

type UpgradeFromFileArgs = {
    apps: string
    file: string
    onTenderlyFork?: boolean
    failedKernelsToFile?: boolean
    batchSize?: string
    remoteFetch?: boolean
    callForwarderAddress?: string
    noBatch: boolean
}

task("upgrade-from-file", "Upgrades a contracts implementation from file bypassing the UpdateManager") // todo: bypassing?
    .addOptionalParam(
        "file",
        'JSON file to kernel addresses with format, e.g. [{"contractAddress" : "0xAb9f24AcF3987412898e28b31CEc6a4Daee21D8E"}]',
        "[]"
    )
    .addOptionalParam("apps", "AppsIds to update, e.g. KERNEL,SUDO")
    .addFlag(
        "onTenderlyFork",
        "Specify if you would prefer tenderly fork rather than hardhat env (tenderly envs should exist in .env)"
    )
    .addFlag("failedKernelsToFile", "Specify if you want to get failed kernels to be reported with errors")
    .addOptionalParam("batchSize", "Specify the batch size", "200")
    .addOptionalParam(
        "callForwarderAddress",
        "If we deploy a new instance of callForwarder, we can update DAOs through the old one"
    )
    .addFlag("noBatch", "whether to use CallForwarder's batchCall")
    .addFlag("remoteFetch", "Specify if you want to fetch kernels from the remote. File param would not be used")
    .setAction(async (args: UpgradeFromFileArgs, hre: HardhatRuntimeEnvironment) => {
        const batchSize = parseInt(args?.batchSize ?? "200", 10)
        const { releaseManager } = await hre.getNamedAccounts() // todo: why there sudo wallet -> change to releaseManager?

        const env = checkStage(hre) ? Environment.STAGE : Environment.MAINNET
        const kernelAddresses = await conditionalKernels(!!args?.remoteFetch, env, args.file)
        const apps = filterApps(args?.apps || [])

        const mb = new cliProgress.MultiBar({
            format: "Upgraded |" + "{bar}" + "| {percentage}% || {value}/{total} kernels || ETA: {eta}s",
            clearOnComplete: false,
            stopOnComplete: true,
            hideCursor: true,
            forceRedraw: true,
        })

        const progress = mb.create(kernelAddresses.length, 0)

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

        const rounds = Math.ceil(kernelAddresses.length / batchSize)
        let contractsWithoutPermission: any[] = []

        for (let i = 0; i < rounds; i++) {
            const prevPointer = batchSize * i
            const currPointer = batchSize * (i + 1)

            const appsToBatch = args?.callForwarderAddress
                ? // this is a shuffle so that the kernel is in the end of the array,
                  // if it is present in the given array
                  [...apps.filter((app) => app !== AppsIds.KERNEL), ...apps.filter((app) => app === AppsIds.KERNEL)]
                : apps

            mb.log(`\n========= BATCH ${prevPointer} - ${currPointer} OF ${kernelAddresses.length} =========\n\n`)
            const appList = appsToBatch.reduce((prev, curr) => prev + curr + " ", "").slice(0, -1)
            mb.log(`upgrading apps ${appList}\n`)

            if (!args?.noBatch) {
                const batchArgs = await upgradeWithBatch(
                    appsToBatch,
                    kernelAddresses.slice(prevPointer, currPointer),
                    releaseManager,
                    engine,
                    false,
                    progress,
                    mb
                )

                const { data, contracts, contractsWithoutPermission: noPermission } = batchArgs
                const signer = await engine.hreEthers.getSigner(releaseManager)
                mb.log(`Apps to upgrade: ${contracts.length}\n`)

                contractsWithoutPermission = noPermission
                const callForwarderAddress = args.callForwarderAddress ? [args.callForwarderAddress] : []
                /// the spreading argument must be the last one!!
                await batchCall(signer, engine, contracts, data, 12_000_000, batchSize, ...callForwarderAddress)
            } else {
                console.log("upgrading without batch...")
                await upgradeNoBatch(
                    [AppsIds.KERNEL],
                    kernelAddresses.slice(prevPointer, currPointer),
                    releaseManager,
                    engine,
                    false,
                    progress,
                    mb
                )
            }

            if (args.failedKernelsToFile) {
                if (contractsWithoutPermission.length > 0) {
                    await promises.writeFile(
                        "./modules/tasks/reports/errors.upgrade.batch-calls.json",
                        JSON.stringify(contractsWithoutPermission, null, 4)
                    )
                }
            }
        }

        progress.stop()
        mb.stop()
    })
