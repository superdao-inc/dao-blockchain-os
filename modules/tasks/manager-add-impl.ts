import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import { encodeAppId } from "@utils//"
import { AppsIds } from "@constants//"
import "@nomiclabs/hardhat-ethers"
import type { Signer } from "ethers"

type AddImplArgs = {
    appid: keyof typeof AppsIds
    kernel: string
    impl: string
}

task("manager-add-impl", "Adds an implementation to UpdateManager")
    .addParam("kernel", "The kernel's address")
    .addParam("appid", "Refer to the AppsIds library")
    .addParam("impl", "Implementation address")
    .setAction(async (args: AddImplArgs, hre: HardhatRuntimeEnvironment) => {
        const kernel = await hre.ethers.getContractAt("Kernel", args.kernel)
        const { chainId } = await hre.ethers.provider.getNetwork()
        const signers = await hre.ethers.getSigners()
        let signer: Signer = signers[0]

        if (chainId === hre.network.config.chainId) {
            const SUDO = process?.env.SUDO_WALLET_ADDRESS || signers[0].address

            await hre.network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [SUDO],
            })

            await hre.network.provider.send("hardhat_setBalance", [SUDO, hre.ethers.utils.parseEther("100")])
            signer = await hre.ethers.getSigner(SUDO)
        }

        if (!AppsIds?.[args?.appid]) {
            console.log(`AppId does not exist. Possible options: ${Object.keys(AppsIds)}`)
            return
        }

        const managerAddress = await kernel.getUpdateManager()
        const manager = await hre.ethers.getContractAt("UpdateManager", managerAddress)

        if (chainId === hre.network.config.chainId) {
            const owner = await manager.owner()
            await hre.network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [owner],
            })

            await hre.network.provider.send("hardhat_setBalance", [owner, hre.ethers.utils.parseEther("100")])
            signer = await hre.ethers.getSigner(owner)
        }

        const appId = encodeAppId(AppsIds[args.appid])
        const tx = await manager.connect(signer).setAppCode(appId, args.impl)
        await tx.wait()
        const implementations = await manager.getAppCodeHistory(appId)
        console.log("Current implementations:")
        console.log(implementations)
        console.log("Implementation added to UpdateManager")
    })
