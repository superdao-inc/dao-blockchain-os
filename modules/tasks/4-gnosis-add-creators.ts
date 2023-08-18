import "@nomiclabs/hardhat-ethers"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import EthersAdapter from "@gnosis.pm/safe-ethers-lib"
import Safe from "@gnosis.pm/safe-core-sdk"
import { task } from "hardhat/config"
import { readFileSync, writeFileSync } from "fs"
import { AppsIds, factoryMapping } from "@constants//"
import { encodeAppId } from "@utils/scripts/format"
import { AdminControllerCallData } from "@utils/call-forwarder-helper"
import { MetaTransactionData, OperationType } from "@gnosis.pm/safe-core-sdk-types"

type UpgradeFromFileArgs = {
    file: string
}

task("add-creators-gnosis", "Upgrades a contracts implementation from file bypassing the UpdateManager")
    .addParam("file", "JSON file")
    .setAction(async (args: UpgradeFromFileArgs, hre: HardhatRuntimeEnvironment) => {
        const signers = await hre.ethers.getSigners()
        const { successTeam } = await hre.getNamedAccounts()
        const { file } = args
        const safeOwner = signers[0]
        const ethAdapter = new EthersAdapter({
            ethers: hre.ethers,
            signer: safeOwner,
        })
        console.log("successTeam - ", successTeam)
        const safeSdk = await Safe.create({ ethAdapter, safeAddress: successTeam })
        const fileD = readFileSync(file, "utf-8")
        const json: any[] = JSON.parse(fileD)
        const transactionsSetCreator: MetaTransactionData[] = []
        let index = 0
        const FIRST = 0
        const LAST = 200
        let failCount = 0
        for (const entry of json.slice(FIRST, LAST)) {
            try {
                const kernel = await hre.ethers.getContractAt(factoryMapping.KERNEL, entry.dao)
                const adminControllerAddr = await kernel.getAppAddress(encodeAppId(AppsIds.ADMIN))
                const adminController = await hre.ethers.getContractAt(factoryMapping.ADMIN, adminControllerAddr)
                const creator = await adminController.creator()

                if (creator !== entry.owner) {
                    const callData = AdminControllerCallData.encodeFunctionData("setCreator", [entry.owner])
                    transactionsSetCreator[index++] = {
                        to: adminControllerAddr,
                        data: callData,
                        value: "0",
                        operation: OperationType.Call,
                    }
                } else {
                    console.log("already done")
                }
            } catch (e) {
                failCount++
                console.log(`Kernel ${entry.dao} failed add creator - ${entry.owner}`)
                const file = readFileSync("./tasks/reports/adds-creators/errors.json", "utf-8")
                const contractMetas = JSON.parse(file)
                contractMetas.push({
                    kernel: entry.dao,
                    owner: entry.owner,
                    error: e,
                })
                writeFileSync("./tasks/reports/errors.tasks.add-creators.json", JSON.stringify(contractMetas))
            }
        }
        if (transactionsSetCreator.length > 0) {
            try {
                const safeTransaction = await safeSdk.createTransaction(transactionsSetCreator)
                console.log(`pending ${transactionsSetCreator.length} tx...`)
                const txSafe = await safeSdk.executeTransaction(safeTransaction, { gasLimit: 20_000_000 }) // {gasLimit: 28_000_000}
                const tx = await txSafe.transactionResponse?.wait(1)
                writeFileSync("./tasks/reports/adds-creators/tx.json", JSON.stringify(tx))

                console.log("Success")
                console.log(tx?.transactionHash)
                console.log(`Failed kernels - ${failCount}`)
            } catch (e) {
                writeFileSync("./tasks/reports/adds-creators/tx.json", JSON.stringify(e))
                console.log("Error")
            }
        }
    })
