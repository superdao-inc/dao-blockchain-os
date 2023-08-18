import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import { factoryMapping } from "@constants//"
import { AppsIds } from "@utils/const"
import "@nomiclabs/hardhat-ethers"
import { ethers, Signer } from "ethers"
import { getImpersonatedSignerWithEths } from "@scripts/hardhat/impersonateAccountWithEths"
import { ChainIds } from "@constants/networks"
import { fundHardhatAccount } from "@scripts/hardhat/fundAccount"

type UpgradeFromFileArgs = {
    ums: string
}

task("deploy-beacons", "Deploys UpgradableBeacons with UpdateManager")
    .addParam("ums")
    .setAction(async (args: UpgradeFromFileArgs, hre: HardhatRuntimeEnvironment) => {
        const signers = await hre.ethers.getSigners()
        const { releaseManager } = await hre.getNamedAccounts()
        const { chainId } = await hre.ethers.provider.getNetwork()
        const ums = args.ums.split(",")
        let signer: Signer = signers[0]

        if (chainId === Number(ChainIds.hardhat)) {
            console.log("This is hardhat network, sudoWallet account will be impersonated and provided with eths...")
            await fundHardhatAccount(hre, (await hre.ethers.getSigners())[0].address, "100")
            signer = await getImpersonatedSignerWithEths(hre.ethers, releaseManager)
        }
        const signerAddress = await signer.getAddress()
        console.log(`Deploying beacons as: ${await signer.getAddress()}`)

        for (const um of ums) {
            console.log("Deploying beacons to UpdateManager", um)
            const updateManager = await hre.ethers.getContractAt(factoryMapping.UPDATE_MANAGER, um, signer)
            const updateManagerOwner = await updateManager.owner()

            if (updateManagerOwner === signerAddress) {
                for (const app of [
                    AppsIds.ADMIN_CONTROLLER,
                    AppsIds.ERC721,
                    AppsIds.ERC721_OPEN_SALE,
                    AppsIds.ERC721_WHITELIST_SALE,
                    AppsIds.KERNEL,
                ]) {
                    console.log(`deploying ${app} beacon...`)
                    const beacon = await updateManager.getBeacon(app)
                    if (beacon === ethers.constants.AddressZero) {
                        const tx = await updateManager.deployBeaconById(app)
                        await tx.wait(1)
                    } else {
                        console.log("beacon already exists, updating")
                        const impl = await updateManager.getLastAppCode(app)
                        const tx = await updateManager.updateBeacon(app, impl)
                        await tx.wait(1)
                    }
                }
            } else {
                console.log("Not a Update Manager", um, "owner", updateManagerOwner, ". Current signer:", signerAddress)
            }
        }
    })
