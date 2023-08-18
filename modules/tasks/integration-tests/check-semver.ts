// A complex integration task with a goal to proceed upgradability checks after commit to a protected branch.
// It deploys implementations, updates them in update manager and proceeds upgradability tests for kernels specified.
// ref to schema: https://miro.com/app/board/uXjVOyZCMKs=/ todo: to notion + more info + readme + tricks
import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import "@nomiclabs/hardhat-ethers"
import { conditionalKernels } from "@utils/tasks/upgradabilityTests"
import { checkStage } from "@utils/scripts/checkStage"
import { Environment } from "@scripts/interfaces/environment"
import { Contract, ethers } from "ethers"
import { getContract } from "@utils/scripts/getContract"
import { Engine } from "@scripts/interfaces/engine"
import { factoryMapping } from "@constants/mappings"
import { validApp } from "@utils/filterApps"
import { AppsIds } from "@constants/appsIds"
// import { Kernel } from "@typechain-types/Kernel"
import { encodeAppId } from "@utils/econdeAppId"
import cliProgress from "cli-progress"
import { writeFile } from "fs/promises"

interface TaskArguments {
    file: string
    app: string
    remoteFetch: boolean
    semver: string
}

task("check-semver", "Integration task with a goal to test semantic versions after update ")
    .addParam("app", "AppsId to check e.g. KERNEL")
    .addParam("semver", "Version at which the app is supposed to be e.g. v1.0.1")
    .addFlag("remoteFetch", "Specify if you want to fetch kernels from the remote. File param would not be used.")
    .addOptionalParam(
        "file",
        "JSON file with kernel addresses with format, e.g. " +
            '[{"contractAddress" : "0xAb9f24AcF3987412898e28b31CEc6a4Daee21D8E"}]'
    )
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        if (!validApp(args.app)) {
            console.log("Provided appId invalid, shutting down")
            return
        }
        const app = args.app as keyof typeof AppsIds
        const env = checkStage(hre) ? Environment.STAGE : Environment.MAINNET
        const kernels = await conditionalKernels(!!args?.remoteFetch, env, args.file)
        const engine: Engine = { hreEthers: hre.ethers }
        console.log("checking " + kernels.length + " apps for semver " + args.semver)

        const mb = new cliProgress.MultiBar({
            format: "Checked |" + "{bar}" + "| {percentage}% || {value}/{total} apps || ETA: {eta}s",
            clearOnComplete: false,
            stopOnComplete: true,
            hideCursor: true,
            forceRedraw: true,
        })

        const progress = mb.create(kernels.length, 0)
        const badKernels = []

        for (const address of kernels) {
            if (address === ethers.constants.AddressZero || address === "") {
                mb.log("not a valid kernel, skipp...\n")
                continue
            }
            const kernel: Contract = await getContract(engine, address, factoryMapping.KERNEL)
            let contract: Contract

            if (app !== AppsIds.KERNEL) {
                const appAddress = await kernel.getAppAddress(encodeAppId(app))
                if (appAddress === ethers.constants.AddressZero || appAddress === "") {
                    mb.log("not a valid app, skipp...\n")
                    continue
                }
                const appContract = await getContract(engine, appAddress, factoryMapping[app])
                contract = appContract
            } else {
                contract = kernel
            }

            try {
                const semver = await contract.__semver()
                if (semver !== args.semver) {
                    badKernels.push(kernel.address)
                    mb.log(`kernel: ${kernel.address} has semver ${semver}\n`)
                }
            } catch (error) {
                mb.log(`kernel: ${kernel.address}, selected app received an error calling semver()\n`)
            }
            progress.increment()
        }

        progress.stop()
        mb.stop()

        if (badKernels.length > 0) {
            console.log("kernels with wrong semvers received, writing to tasks/reports")

            await writeFile(
                `./modules/tasks/reports/semvers_${app}.json`,
                JSON.stringify(
                    {
                        app,
                        semver: args.semver,
                        kernels: badKernels,
                    },
                    null,
                    4
                )
            )
        }
    })
