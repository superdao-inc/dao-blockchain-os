import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import "@nomiclabs/hardhat-ethers"

type ImpersonateArgs = {
    address: string
}

task("impersonate-account", "Impersonates an account in Hardhat network")
    .addParam("address", "Account address")
    .setAction(async (args: ImpersonateArgs, hre: HardhatRuntimeEnvironment) => {
        const { chainId } = await hre.ethers.provider.getNetwork()
        // TODO: hre.network.config.chainId is undefined
        if (chainId !== 31337) {
            return
        }
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [args.address],
        })
        console.log(`impersonated ${args.address}`)
    })
