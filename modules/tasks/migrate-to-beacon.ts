import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import "@nomiclabs/hardhat-ethers"
import { conditionalKernels } from "@utils/tasks/upgradabilityTests"
import { checkStage } from "@utils/scripts/checkStage"
import { Environment } from "@scripts/interfaces/environment"
import { Contract } from "ethers"
import { getContract } from "@utils/scripts/getContract"
import { Engine } from "@scripts/interfaces/engine"
import { factoryMapping } from "@constants/mappings"
import { writeFile } from "fs/promises"
import { migrateKernelToBeacon } from "@utils/scripts/migrate"
import cliProgress from "cli-progress"
import { batchCall } from "@utils/scripts/batch-call"
import { ChainIds } from "@constants/networks"
import { getImpersonatedSignerWithEths } from "@scripts/hardhat/impersonateAccountWithEths"

interface TaskArguments {
    file: string
    remoteFetch: boolean
    ums: string
    batchSize: string
    noBatch: boolean
}

task("migrate-to-beacon", "Migration task intended for a single use")
    .addFlag("remoteFetch", "Specify if you want to fetch kernels from the remote. File param would not be used.")
    .addOptionalParam(
        "file",
        "JSON file with kernel addresses with format, e.g. " +
            '[{"contractAddress" : "0xAb9f24AcF3987412898e28b31CEc6a4Daee21D8E"}]'
    )
    .addParam("ums", "UpdateManager addresses")
    .addOptionalParam("batchSize", "Specify the batch size", "200")
    .addFlag("noBatch", "Whether to use batch")
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const batchSize = parseInt(args?.batchSize ?? "200", 10)
        const env = checkStage(hre) ? Environment.STAGE : Environment.MAINNET
        const kernels = await conditionalKernels(!!args?.remoteFetch, env, args.file)

        const ums = args.ums.split(",")
        const engine: Engine = { hreEthers: hre.ethers, deployments: hre.deployments }
        console.log("\nMigrating " + kernels.length + " kernels to support UpgradableBeacon\n")

        const { releaseManager } = await hre.getNamedAccounts()
        const { chainId } = await engine.hreEthers.provider.getNetwork()

        if (chainId === Number(ChainIds.hardhat)) {
            await getImpersonatedSignerWithEths(engine.hreEthers, releaseManager)
        }

        const mb = new cliProgress.MultiBar({
            format: "Migrated |" + "{bar}" + "| {percentage}% || {value}/{total} kernels || ETA: {eta}s",
            clearOnComplete: false,
            stopOnComplete: true,
            hideCursor: true,
            forceRedraw: true,
        })

        const progress = mb.create(kernels.length, 0)
        let errors: any[] = []

        const rounds = Math.ceil(kernels.length / batchSize)

        for (let i = 0; i < rounds; i++) {
            let contracts: Contract[] = []
            let data: string[] = []

            const prevPointer = batchSize * i
            const currPointer = batchSize * (i + 1)
            const kernelAddresses = kernels.slice(prevPointer, currPointer)

            for (const address of kernelAddresses) {
                const kernel: Contract = await getContract(engine, address, factoryMapping.KERNEL)
                const {
                    errors: err,
                    contracts: bct,
                    data: bdt,
                } = await migrateKernelToBeacon(hre, kernel, !args?.noBatch, ums, mb)
                errors = errors.concat(err)
                contracts = contracts.concat(bct)
                data = data.concat(bdt)
                progress.increment()
            }

            if (!args?.noBatch) {
                const { releaseManager } = await hre.getNamedAccounts()
                const signer = await engine.hreEthers.getSigner(releaseManager)
                await batchCall(signer, engine, contracts, data, 12_000_000, batchSize, undefined, mb)
            }
        }

        progress.stop()
        mb.stop()

        if (errors.length > 0) {
            console.log("Migration errors happened, writing to tasks/reports")

            await writeFile(`./modules/tasks/reports/beacon_migration_error.json`, JSON.stringify(errors, null, 4))
        }

        console.log(`received ${errors.length} errors while migrating`)
    })
