import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import "hardhat-deploy"
import { UniswapV3Oracle } from "@typechain-types//"
import "@nomiclabs/hardhat-ethers"
import { ethers } from "hardhat"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployer, releaseManager, usdcAddress, usdtAddress, wmaticAddress, nativeToken, uniswapV3Factory } =
        await hre.getNamedAccounts()

    await hre.deployments.deploy("UniswapV3Oracle", {
        from: deployer,
        args: [wmaticAddress, nativeToken],
        log: true,
        autoMine: true,
        waitConfirmations: 1,
    })

    const uniswapV3FactoryAddress =
        uniswapV3Factory != null ? uniswapV3Factory : (await hre.deployments.get("UniswapV3Factory")).address

    const isUniswapV3OracleProxyExists = (await hre.deployments.getOrNull("UniswapV3OracleProxy")) != null

    if (!isUniswapV3OracleProxyExists) {
        const UniswapV3Oracle = await hre.deployments.get("UniswapV3Oracle")

        const UniswapV3OracleProxy = await hre.deployments.deploy("UniswapV3OracleProxy", {
            from: deployer,
            args: [UniswapV3Oracle.address],
            contract: "AppProxy",
            log: true,
            autoMine: true,
            waitConfirmations: 1,
        })

        const UniswapV3OracleProxyContract = (await hre.ethers.getContractAt(
            "UniswapV3Oracle",
            UniswapV3OracleProxy.address
        )) as UniswapV3Oracle
        let tx = await UniswapV3OracleProxyContract.initialize(uniswapV3FactoryAddress, 3600, releaseManager)
        await tx.wait(1)

        const releaseManagerSigner = await ethers.getSigner(releaseManager)

        tx = await UniswapV3OracleProxyContract.connect(releaseManagerSigner).setWhitelistTokenAddress([
            usdcAddress,
            usdtAddress,
            wmaticAddress,
        ])
        await tx.wait(1)
    }
}

export default func
func.tags = ["UniswapV3Oracle"]
