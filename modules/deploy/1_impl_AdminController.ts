import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import "hardhat-deploy"
import "@nomiclabs/hardhat-ethers"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployer } = await hre.getNamedAccounts()

    const callForwarder = await hre.deployments.get("CallForwarder")

    await hre.deployments.deploy("AdminController", {
        from: deployer,
        args: [callForwarder.address],
        log: true,
        autoMine: true,
        waitConfirmations: 1,
    })
}

export default func
func.tags = ["AdminController", "implementations"]
