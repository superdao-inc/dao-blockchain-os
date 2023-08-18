import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import { encodeAppId } from "@utils//"
import { AppsIds } from "@constants//"
import "@nomiclabs/hardhat-ethers"
import type { Signer } from "ethers"

type UpgradeArgs = {
    appid: keyof typeof AppsIds
    kernel: string
    impl: string
}

task("upgrade-impl", "Upgrades a contract's implementation bypassing the UpdateManager")
    .addParam("kernel", "The kernel's address")
    .addParam("appid", "Refer to the AppsIds library")
    .addParam("impl", "Implementation address")
    .setAction(async (args: UpgradeArgs, hre: HardhatRuntimeEnvironment) => {
        const kernel = await hre.ethers.getContractAt("Kernel", args.kernel)
        const signers = await hre.ethers.getSigners()
        const { chainId } = await hre.ethers.provider.getNetwork()
        let signer: Signer = signers[0]

        if (chainId === hre.network.config.chainId) {
            const SUDO = process?.env.SUDO_WALLET_ADDRESS || signers[0].address

            await hre.network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [SUDO],
            })

            await hre.network.provider.send("hardhat_setBalance", [SUDO, hre.ethers.utils.parseEther("100")])
            signer = await hre.ethers.getSigner(SUDO)
            const signerAddress = await signer.getAddress()
            console.log(`Upgrading as: ${signerAddress}`)
        }

        if (!AppsIds?.[args?.appid]) {
            console.log(`AppId does not exist. Possible options: ${Object.keys(AppsIds)}`)
            return
        }

        const appId = encodeAppId(AppsIds[args.appid])
        const tx = await kernel.connect(signer).upgradeAppImpl(appId, args.impl)
        await tx.wait()
        console.log("App upgraded successfully")
    })
