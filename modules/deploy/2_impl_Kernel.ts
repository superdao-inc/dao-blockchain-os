import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import "hardhat-deploy"
import "@nomiclabs/hardhat-ethers"
import { getImpersonatedSignerWithEths } from "@scripts/hardhat/impersonateAccountWithEths"
import { ChainIds } from "@constants/networks"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployer, releaseManager, gnosisSafeFactory, gnosisSafeSingleton, gnosisSafeFallbackHandler } =
        await hre.getNamedAccounts()

    const { chainId } = await hre.ethers.provider.getNetwork()
    if (chainId === Number(ChainIds.hardhat)) {
        await getImpersonatedSignerWithEths(hre.ethers, releaseManager)
    }

    const callForwarder = await hre.deployments.get("CallForwarder")
    const updateManager = await hre.deployments.get("UpdateManagerProxy")

    const gnosisSafeSingletonAddr =
        gnosisSafeSingleton != null ? gnosisSafeSingleton : (await hre.deployments.get("GnosisSafeL2")).address

    const gnosisSafeFactoryAddr =
        gnosisSafeFactory != null ? gnosisSafeFactory : (await hre.deployments.get("GnosisSafeProxyFactory")).address

    const gnosisSafeFallbackHandlerAddr =
        gnosisSafeFallbackHandler != null
            ? gnosisSafeFallbackHandler
            : (await hre.deployments.get("CompatibilityFallbackHandler")).address

    const kernel = await hre.deployments.deploy("Kernel", {
        from: deployer,
        args: [
            callForwarder.address,
            updateManager.address,
            gnosisSafeSingletonAddr,
            gnosisSafeFactoryAddr,
            gnosisSafeFallbackHandlerAddr,
        ],
        log: true,
        autoMine: true,
        waitConfirmations: 1,
    })
}

export default func
func.tags = ["Kernel", "implementations"]
