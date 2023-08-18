import { task } from "hardhat/config"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import "@nomiclabs/hardhat-ethers"
import { readFileSync, writeFileSync, promises } from "fs"
import { AppsIds, factoryMapping } from "@constants//"
import { encodeAppId } from "@utils/econdeAppId"
import { Engine } from "@scripts/interfaces/engine"
import { batchCall } from "@utils/scripts/batch-call"

type UpgradeArgs = {
    file: string
    appid1: keyof typeof AppsIds
    appid2: keyof typeof AppsIds
    permissionid: number
}

// pnpm hardhat add-permission-from-file --file {filePath} --appid1 ADMIN --appid2 KERNEL --permissionid 0 --network mainnet

task("add-permission-batch-file", "Adding permissions")
    .addParam(
        "file",
        'JSON file to kernel addresses with format, e.g. [{"contractAddress" : "0xAb9f24AcF3987412898e28b31CEc6a4Daee21D8E"}]'
    )
    .addParam("appid1", "Requester AppId. For example - ADMIN, ERC721 (look to AppsIds.ts)")
    .addParam("appid2", "Receiver AppId. For example - ADMIN, ERC721 (look to AppsIds.ts)")
    .addParam("permissionid", "Role for app. For example - 0")
    .setAction(async (args: UpgradeArgs, hre: HardhatRuntimeEnvironment) => {
        const start = new Date()

        const { file, appid1, appid2, permissionid } = args
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
                const hasPermission = await kernel.hasPermission(releaseManager, kernel.address, 0)

                if (hasPermission) {
                    data.push(
                        (
                            await kernel.populateTransaction.addPermission(
                                encodeAppId(AppsIds[appid1]),
                                encodeAppId(AppsIds[appid2]),
                                permissionid
                            )
                        ).data!
                    )
                    contracts.push(kernel)
                } else {
                    console.log(`Kernel - ${kernel.address} doesn't have permission`)
                    failedKernels.push({
                        contractAddress: entry.contractAddress,
                        message: "doesn't have permission",
                    })
                }
            } catch (e) {
                failedKernels.push({
                    contractAddress: entry.contractAddress,
                    message: e,
                })
                console.log(`Kernel ${entry.contractAddress} failed to add permission`)
            }
        }

        await batchCall(await hre.ethers.getSigner(releaseManager), engine, contracts, data)

        console.log(`Failed kernels - ${failedKernels.length}`)

        if (failedKernels.length > 0) {
            console.log("failed kernels have been saved to ./tasks/reports/errors.tasks.permissions.json")
            await promises.writeFile("./tasks/reports/errors.tasks.permissions.json", JSON.stringify(failedKernels))
        }

        console.log(`Done! It takes - ${new Date(new Date().getTime() - start.getTime()).toISOString().slice(11, 19)}`)
    })
