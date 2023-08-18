import { HardhatRuntimeEnvironment } from "hardhat/types"

export type FundHardhatAccount = (hre: HardhatRuntimeEnvironment, address: string, amount: string) => Promise<void>

export const fundHardhatAccount: FundHardhatAccount = async (hre, address, amount) => {
    await hre.network.provider.send("hardhat_setBalance", [
        address,
        hre.ethers.utils.parseEther(amount).toHexString().replace("0x0", "0x"),
    ])
    console.log(`funded ${address} with ${amount} ETH`)
}
