import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import "hardhat-deploy"
import "@nomiclabs/hardhat-ethers"
import { DOMAIN, VERSION } from "@constants//"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployer } = await hre.getNamedAccounts()

    await hre.deployments.deploy("CallForwarder", {
        from: deployer,
        args: [DOMAIN, VERSION],
        log: true,
        autoMine: true,
        waitConfirmations: 1,
    })
}

export default func
func.tags = ["CallForwarder", "protocol"]
