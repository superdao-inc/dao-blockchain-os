import { BigNumberish, ContractReceipt, ContractTransaction, utils } from "ethers/lib/ethers"
import { deployments, ethers, getNamedAccounts } from "hardhat"
import { DAOConstructor } from "@typechain-types//"
import {
    AdminSettingsStruct,
    DeploymentSettingsStruct,
    NFTSettingsStruct,
    SaleSettingsStruct,
} from "@typechain-types/DAOConstructor"
import daos from "./input/sample-create-dao.json"

async function main() {
    const { releaseManager } = await getNamedAccounts()
    const DAOConstructorAddress = (await deployments.get("DAOConstructorProxy")).address
    const DAOConstructor = (await ethers.getContractAt("DAOConstructor", DAOConstructorAddress)) as DAOConstructor

    DAOConstructor.on("Deployed", (kernel: string, modules: any, settings: any, event: any) => {
        console.log("kernel:", kernel, "tx:", event.transactionHash)
    })

    for (const dao of daos) {
        const adminSettings: AdminSettingsStruct = {
            admins: dao.deploymentSettings.adminSettings.admins,
            creator: dao.deploymentSettings.adminSettings.creator,
            releaseManager: dao.deploymentSettings.adminSettings.releaseManager,
        }
        const emptySaleSettings: SaleSettingsStruct = {
            tiersValues: [],
            tiersPrices: [],
            claimLimit: 0,
            tokenSaleAddress: dao.deploymentSettings.openSaleSettings.tokenSaleAddress,
        }
        const settings: DeploymentSettingsStruct = {
            adminSettings,
            nftSettings: dao.deploymentSettings.nftSettings,
            openSaleSettings: emptySaleSettings,
            whiteListSaleSettings: emptySaleSettings,
        }

        const tx: ContractTransaction = await DAOConstructor.deploy(dao.modules, settings, dao.treasury, {
            gasLimit: 2_000_000,
        })
        const reciept: ContractReceipt = await tx.wait(10)
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
