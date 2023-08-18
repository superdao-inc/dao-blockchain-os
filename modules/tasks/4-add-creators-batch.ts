import { task } from "hardhat/config"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import "@nomiclabs/hardhat-ethers"
import { readFileSync, writeFileSync } from "fs"
import { AppsIds, factoryMapping } from "@constants//"
import { encodeAppId } from "@utils/scripts/format"
import { batchCall } from "@utils/scripts/batch-call"
import { Engine } from "@scripts/interfaces/engine"

type UpgradeArgs = {
    file: string
}

// pnpm hardhat add-creators-file --file {filePath} --network mainnet

task("add-creators-batch-file", "Adding creators")
    .addParam(
        "file",
        'JSON file to kernel addresses with format, e.g. [{"contractAddress" : "0xAb9f24AcF3987412898e28b31CEc6a4Daee21D8E", owner : 0xAb9f24AcF3987412898e28b31CEc6a4Daee21D8E}]'
    )
    .setAction(async (args: UpgradeArgs, hre: HardhatRuntimeEnvironment) => {
        const start = new Date()
        const { file } = args
        const fileD = readFileSync(file, "utf-8")
        const json: any[] = JSON.parse(fileD)
        const failedKernels = []
        const { releaseManager } = await hre.getNamedAccounts()
        const contracts = []
        const data: string[] = []
        const FIRST = 0
        const LAST = 200

        const engine: Engine = { hreEthers: hre.ethers, deployments: hre.deployments }
        console.log("building calldata...")
        for (const entry of json.slice(FIRST, LAST)) {
            try {
                const kernel = await hre.ethers.getContractAt(factoryMapping.KERNEL, entry.contractAddress)
                const adminControllerAddr = await kernel.getAppAddress(encodeAppId(AppsIds.ADMIN))
                const adminController = await hre.ethers.getContractAt(factoryMapping.ADMIN, adminControllerAddr)
                const creator = await adminController.creator()
                if (creator !== entry.owner) {
                    contracts.push(adminController)
                    data.push((await adminController.populateTransaction.setCreator(entry.owner)).data!)
                }
            } catch (e) {
                failedKernels.push({
                    kernel: entry.contractAddress,
                    owner: entry.owner,
                    message: e,
                })
                console.log(`Kernel ${entry.contractAddress} failed to add creator - ${entry.owner}`)
            }
        }

        await batchCall(await hre.ethers.getSigner(releaseManager), engine, contracts, data)

        if (failedKernels.length > 0) {
            console.log("failed kernels have been saved to ./tasks/reports/adds-creators/errors.json")
            writeFileSync("./tasks/reports/adds-creators/errors.json", JSON.stringify(failedKernels))
        }
        console.log(`Done! It takes - ${new Date(new Date().getTime() - start.getTime()).toISOString().slice(11, 19)}`)
    })
