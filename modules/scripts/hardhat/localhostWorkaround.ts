import { Engine } from "@scripts/interfaces/engine"
import { HardhatRuntimeEnvironment } from "hardhat/types"

export const localhostWorkaround = (hre: HardhatRuntimeEnvironment, engine?: Engine) => {
    // workaround for localhost network
    // https://github.com/NomicFoundation/hardhat/issues/1226
    let provider
    const hreEth = engine ? engine.hreEthers : hre.ethers

    // @ts-ignore
    if (hre.network.config?.url !== undefined) {
        provider = new hreEth.providers.JsonRpcProvider("http://localhost:8545")
    }
    provider = hreEth.provider

    return provider
}
