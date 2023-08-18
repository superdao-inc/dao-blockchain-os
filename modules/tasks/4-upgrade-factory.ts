import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import "@nomiclabs/hardhat-ethers"
import { Contract, Signer } from "ethers"

task("upgrade-factory", "Upgrading DAOConstructor").setAction(async (args, hre: HardhatRuntimeEnvironment) => {
    const factoryAddress = (await hre.deployments.get("DAOConstructorProxy")).address
    const factory: Contract = await hre.ethers.getContractAt("DAOConstructor", factoryAddress)
    const newDaoContstructor = await hre.deployments.get("DAOConstructor")
    const newfactory: Contract = await hre.ethers.getContractAt("DAOConstructor", newDaoContstructor.address)
    const impl = await factory.implementation()
    console.log(
        "impl - ",
        impl,
        "Semver:",
        await factory.__semver(),
        "\nnewImpl - ",
        newDaoContstructor.address,
        "Semver:",
        await newfactory.__semver()
    )
    return
    const tx = await factory.upgrade(newDaoContstructor.address)
    console.log("tx - ", tx.hash)
    await tx.wait(1)
    console.log("success")
})
