import type { BigNumber, BytesLike } from "ethers"
import { ethers, getNamedAccounts } from "hardhat"

const toBytes32 = (bn: BigNumber) => {
    return ethers.utils.hexlify(ethers.utils.zeroPad(bn.toHexString(), 32))
}

const setStorageAt = async (address: string, index: string, value: BytesLike) => {
    await ethers.provider.send("hardhat_setStorageAt", [address, index, value])
    await ethers.provider.send("evm_mine", [])
}

export const fundUSDC = async (userAddress: string, value: BigNumber) => {
    const USDC_slot = 0
    const { usdcAddress } = await getNamedAccounts()

    const index = ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [userAddress, USDC_slot] // key, slot
    )

    await setStorageAt(usdcAddress, index.toString(), toBytes32(value).toString())
}
