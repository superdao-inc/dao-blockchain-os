import { HardhatSimulator } from "@scripts/clients/hardhat/hardhatSimulator"
import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

export async function getImpersonatedSignerWithEths(
    hreEthers: typeof ethers,
    accountAddress: string
): Promise<SignerWithAddress> {
    // workaround for localhost network
    // https://github.com/NomicFoundation/hardhat/issues/1226
    // @ts-ignore
    if (hre.network.config?.url !== undefined) {
        const provider = new hreEthers.providers.JsonRpcProvider("http://localhost:8545")
        hreEthers.provider = provider
    }

    const simulatorHardhat: HardhatSimulator = new HardhatSimulator({ rpcProvider: hreEthers.provider })
    await simulatorHardhat.setBalance(accountAddress, "100000000000000000000")
    await simulatorHardhat.impersonateAccount(accountAddress)
    return await hreEthers.getSigner(accountAddress)
}
