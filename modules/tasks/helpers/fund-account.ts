import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import "@nomiclabs/hardhat-ethers"

type FundArgs = {
    address: string
    amount: string
}

task("fund-account", "Funds an account in Hardhat network")
    .addParam("address", "Account address")
    .addParam("amount", "Amount in ETH")
    .setAction(async (args: FundArgs, hre: HardhatRuntimeEnvironment) => {
        const { chainId } = await hre.ethers.provider.getNetwork()
        // TODO: hre.network.config.chainId is undefined
        if (chainId !== 31337) {
            return
        }

        await hre.network.provider.send("hardhat_setBalance", [
            args.address,
            hre.ethers.utils.parseEther(args.amount).toHexString().replace("0x0", "0x"),
        ])
        console.log(`funded ${args.address} with ${args.amount} ETH`)
    })
