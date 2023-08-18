import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import "hardhat-deploy"
import "@nomiclabs/hardhat-ethers"
import { ethers } from "ethers"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployer, releaseManager } = await hre.getNamedAccounts()

    const isManagerProxyExist = (await hre.deployments.getOrNull("UpdateManagerProxy")) != null
    const kernel = await hre.deployments.getOrNull("Kernel")
    const kernelImpl = kernel != null ? kernel.address : ethers.constants.AddressZero
    const adminImpl = (await hre.deployments.get("AdminController")).address
    const erc721Impl = (await hre.deployments.get("ERC721Properties")).address
    const erc721OpenSaleImpl = (await hre.deployments.get("ERC721OpenSale")).address
    const erc721WhitelistSaleImpl = (await hre.deployments.get("ERC721WhitelistSale")).address

    const updateManagerCode = await hre.deployments.deploy("UpdateManager", {
        from: deployer,
        args: [],
        log: true,
        autoMine: true,
        waitConfirmations: 1,
    })

    if (!isManagerProxyExist) {
        const updateManagerProxy = await hre.deployments.deploy("UpdateManagerProxy", {
            from: deployer,
            args: [updateManagerCode.address],
            contract: "AppProxy",
            log: true,
            autoMine: true,
            waitConfirmations: 1,
        })
        const updateManagerContract = await hre.ethers.getContractAt("UpdateManager", updateManagerProxy.address)
        await (
            await updateManagerContract.initialize(
                kernelImpl,
                adminImpl,
                erc721Impl,
                erc721OpenSaleImpl,
                erc721WhitelistSaleImpl
            )
        ).wait()

        await (await updateManagerContract.transferOwnership(releaseManager)).wait()
    }
}

export default func
func.tags = ["UpdateManager", "protocol"]
