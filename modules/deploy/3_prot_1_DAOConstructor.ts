import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import "hardhat-deploy"
import "@nomiclabs/hardhat-ethers"
import { UpdateManager, DAOConstructor } from "@typechain-types//"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployer, successTeam } = await hre.getNamedAccounts()
    const { deploy } = hre.deployments

    const DAOConstructor = await deploy("DAOConstructor", {
        from: deployer,
        log: true,
        args: [],
        waitConfirmations: 1,
    })

    const isDAOConstructorProxyExist = (await hre.deployments.getOrNull("DAOConstructorProxy")) != null
    if (!isDAOConstructorProxyExist) {
        const DAOConstructorProxy = await hre.deployments.deploy("DAOConstructorProxy", {
            from: deployer,
            args: [DAOConstructor.address],
            contract: "AppProxy",
            log: true,
            autoMine: true,
            waitConfirmations: 1,
        })
        const DAOConstructorProxyContract = (await hre.ethers.getContractAt(
            "DAOConstructor",
            DAOConstructorProxy.address
        )) as DAOConstructor
        const updateManagerProxyAddress = (await hre.deployments.get("UpdateManagerProxy")).address
        await (await DAOConstructorProxyContract.initialize(updateManagerProxyAddress)).wait()
        await (await DAOConstructorProxyContract.transferOwnership(successTeam)).wait()
    }
}

export default func
func.tags = ["DAOConstructor", "protocol"]
