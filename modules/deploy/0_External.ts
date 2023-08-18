import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import "hardhat-deploy"
import "@nomiclabs/hardhat-ethers"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployer } = await hre.getNamedAccounts()

    const network = await hre.getChainId()
    if (network !== "31337") return
    // deploy gnosis dependencies
    await hre.deployments.deploy("GnosisSafeL2", {
        from: deployer,
    })

    await hre.deployments.deploy("GnosisSafeProxyFactory", {
        from: deployer,
    })

    await hre.deployments.deploy("CompatibilityFallbackHandler", {
        from: deployer,
    })

    await hre.deployments.deploy("MultiSend", {
        from: deployer,
    })

    await hre.deployments.deploy("UniswapV3Factory", {
        from: deployer,
    })
}

export default func
func.tags = ["local"]
