// todo: it is a temporary solution - we want to migrate to self-designed node (aka hardhat) later
import { AppsIds, factoryMapping } from "@constants//"
import { Contract, ethers } from "ethers"
// import { Kernel, UpdateManager } from "../../typechain-types";  // todo: can not use coz of hardhat task import
import "hardhat-deploy/dist/src/type-extensions"
import { encodeAppId } from "@utils/scripts/format"
import { HardhatSimulator } from "../clients/hardhat/hardhatSimulator"
import { ChainIds } from "@constants/networks"
import { Engine } from "../interfaces/engine"
import { getContract } from "@utils/scripts/getContract"
import { SemVer } from "semver"
import { createReleaseApp } from "./create-release-manager"
import { getImpersonatedSignerWithEths } from "@scripts/hardhat/impersonateAccountWithEths"
import { loggerLog } from "./upgrade-apps-impls-batch"
import { logEngine } from "@utils/scripts/migrate"
import type cliProgress from "cli-progress"

export async function upgradeAppImpls(
    apps: Array<string>,
    kernelAddresses: Array<string>,
    signerAddress: string,
    engine: Engine,
    raiseOnError = false,
    progress?: cliProgress.SingleBar,
    logger?: any
) {
    for (const kernelAddress of kernelAddresses) {
        if (kernelAddress === "" || kernelAddress === "0x") continue
        logEngine(loggerLog("Processing kernel", kernelAddress), logger)

        // as Kernel;  // todo can not use coz of hardhat task
        const kernel = await getContract(engine, kernelAddress, factoryMapping.KERNEL)
        let isKernelContract = false
        let updateManagerAddress = "undefined"
        let updateManager
        let updateManagerOwnerAddress
        let isKernelAdmin = false

        try {
            updateManagerAddress = await kernel.getUpdateManager()
            logEngine(loggerLog("Update manager address (got from kernel)", updateManagerAddress), logger)
            if (updateManagerAddress !== "0x0000000000000000000000000000000000000000") {
                isKernelContract = true
            }
        } catch (e) {
            if (raiseOnError) {
                throw e
            }
            const message = (e as Error).message
            logEngine(loggerLog(message), logger)
        }
        try {
            logEngine(loggerLog("check signer address for rights", signerAddress), logger)
            // todo: remove try/except after merge of 91 MR
            isKernelAdmin = await kernel.hasPermission(signerAddress, kernel.address, 0)
        } catch (e) {
            logEngine(loggerLog("Kernel has permission failed..."), logger)
            if (raiseOnError) {
                throw e
            }
            const message = (e as Error).message
            logEngine(loggerLog(message), logger)
        }

        if (isKernelContract) {
            try {
                // as UpdateManager;  // todo can not use coz of hardhat task
                updateManager = await getContract(engine, updateManagerAddress, factoryMapping.UPDATE_MANAGER)
                updateManagerOwnerAddress = await updateManager.owner()
                logEngine(loggerLog("Update manager owner", updateManagerOwnerAddress), logger)
                await upgradeApps(
                    engine,
                    apps,
                    updateManager,
                    isKernelAdmin,
                    kernel,
                    signerAddress,
                    raiseOnError,
                    logger
                )
            } catch (e) {
                if (raiseOnError) {
                    throw e
                }
                const message = (e as Error).message
                logEngine(loggerLog(message), logger)
            }
        } else {
            logEngine(loggerLog("Not a valid kernel contract"), logger)
        }
    }
}

async function upgradeApps(
    engine: Engine,
    apps: Array<string>,
    updateManager: any,
    isKernelAdmin: boolean,
    kernel: any,
    signerAddress: string,
    raiseOnError = false,
    logger?: any
) {
    for (let i = 0; i < apps.length; i++) {
        const appId: keyof typeof AppsIds = apps[i] as keyof typeof AppsIds
        const newImplAddress = await updateManager.getLastAppCode(encodeAppId(appId))

        if (isKernelAdmin) {
            logEngine(loggerLog(`Upgrading app ${factoryMapping[appId]} to a new address ${newImplAddress}...`), logger)
            await upgradeAppAndMigrate(engine, kernel, appId, newImplAddress, signerAddress, raiseOnError, logger)
        } else {
            logEngine(loggerLog("Not a kernel admin of", kernel.address), logger)
        }
    }
}

async function upgradeAppAndMigrate(
    engine: Engine,
    kernel: any,
    appId: keyof typeof AppsIds,
    newImplAddress: string,
    signerAddress: string,
    raiseOnError = false,
    logger?: any
) {
    const appProxyAddress = await kernel.getAppAddress(encodeAppId(appId))
    let appProxy = (await getContract(engine, appProxyAddress, factoryMapping[appId])) as Contract

    const { chainId } = await engine.hreEthers.provider.getNetwork()

    if (chainId === Number(ChainIds.hardhat)) {
        logEngine(
            loggerLog("This is hardhat network, sudoWallet account will be impersonated and provided with eths..."),
            logger
        )
        const signer = await getImpersonatedSignerWithEths(engine.hreEthers, signerAddress)
        appProxy = appProxy.connect(signer)
        kernel = kernel.connect(signer)
    }

    let currentImplAddress = ""

    try {
        currentImplAddress = await appProxy.implementation()
    } catch (error) {
        logEngine(loggerLog("implementation() method not supported, skipping the update"), logger)
        return
    }

    if (currentImplAddress !== newImplAddress) {
        const permissions = 0

        let appSemVer = new SemVer("0.0.0")
        try {
            appSemVer = new SemVer(await kernel.__semver())
        } catch {}
        logEngine(loggerLog("SemVer:", appSemVer.raw), logger)

        if (appId === AppsIds.ERC721 && appSemVer.compare("1.0.2") < 0) {
            let hasPermissionToERC721 = false
            try {
                logEngine(loggerLog(`check permission of signer to app ${appId}...`), logger)
                hasPermissionToERC721 = await kernel.hasPermission(signerAddress, appProxyAddress, permissions)
            } catch (e) {
                if (raiseOnError) {
                    throw e
                }
            }
            if (hasPermissionToERC721) {
                // todo: this once running logic should be relocated
                // todo: if left - post methods should be refactored to engine depending
                const oldName = await appProxy.name()
                const oldSymbol = await appProxy.symbol()
                if (!engine.hreEthers) {
                    throw Error("Only hardhat ethers could be used now") // todo: tmp solution
                }

                logEngine(loggerLog(`Upgrade ${appId} in kernel...`), logger)
                let tx = await upgradeAppInKernel(engine, kernel, signerAddress, appId)
                await tx.wait(1)

                logEngine(loggerLog(`Set name... Old name:`, oldName), logger)
                tx = await appProxy.setName(oldName, { gasLimit: 100_000 })
                await tx.wait(1)

                logEngine(loggerLog(`Set symbol... Old symbol:`, oldSymbol), logger)
                tx = await appProxy.setSymbol(oldSymbol, { gasLimit: 100_000 })
                await tx.wait(1)

                logEngine(loggerLog("Migration successful for", appId), logger)
                logEngine(loggerLog("New app implementation successfully added to app proxy"), logger)
            } else {
                logEngine(loggerLog("Error: has no permissions", permissions, "to", appId), logger)
            }
        } else if (appId === AppsIds.ERC721_OPEN_SALE && appSemVer.compare("1.1.1") < 0) {
            const maticAddress = "0x0000000000000000000000000000000000001010"

            logEngine(loggerLog(`Upgrade ${appId} in kernel with signer addreess`, signerAddress), logger)
            let tx = await upgradeAppInKernel(engine, kernel, signerAddress, appId)
            await tx.wait(1)

            const hasPermissionToSale = await kernel.hasPermission(signerAddress, appProxy.address, 0)

            if (!hasPermissionToSale) {
                try {
                    await createReleaseApp(kernel, signerAddress, raiseOnError)
                } catch (e) {
                    if (raiseOnError) {
                        throw e
                    }
                    const message = (e as Error).message
                    logEngine(loggerLog(message), logger)
                }
            }

            logEngine(loggerLog(`Set token sale address:`, maticAddress), logger)
            tx = await appProxy.setTokenSaleAddress(maticAddress, { gasLimit: 100_000 })
            await tx.wait(1)

            logEngine(
                loggerLog("Migration successful for", appId, "with token address", await appProxy.tokenSaleAddress()),
                logger
            )
        } else {
            logEngine(loggerLog(`Upgrade ${appId} in kernel...`), logger)
            await upgradeAppInKernel(engine, kernel, signerAddress, appId, logger)
            logEngine(loggerLog("New app implementation successfully added to app proxy"), logger)
        }
    } else {
        logEngine(loggerLog("Current proxy refers to the last implementation, no upgrades"), logger)
    }
}

// todo: no Kernel type coz of hardhat task
async function upgradeAppInKernel(engine: Engine, kernel: any, signerAddress: string, appId: string, logger?: any) {
    if (engine.hreEthers) {
        // signerAddress should be impersonated or passed to hardhat directly through private
        // if we work on mainnet
        const { chainId } = await engine.hreEthers.provider.getNetwork()
        if (chainId === Number(ChainIds.hardhat)) {
            logEngine(loggerLog(`In hardhat node impersonated account ${signerAddress} will be used...`), logger)
            const simulatorHardhat: HardhatSimulator = new HardhatSimulator({ rpcProvider: engine.hreEthers.provider })
            await simulatorHardhat.impersonateAccount(signerAddress)
        }

        const signer = await engine.hreEthers.getSigner(signerAddress)
        const kernelWithSigner = kernel.connect(signer)
        logEngine(loggerLog(`upd manager: ${await kernel.getUpdateManager()}`), logger)
        logEngine(loggerLog(`appId: ${appId}`), logger)
        logEngine(loggerLog(`debug: ${encodeAppId(appId)}`), logger)
        const tx = await kernelWithSigner.upgradeApp(encodeAppId(appId), { gasLimit: 100000 })
        await tx.wait(1)
        return tx
    }
    // todo: tenderly specific only: it is better to move logic of transaction sending method into simulator class

    const unsignedTx = await kernel.populateTransaction.upgradeApp(encodeAppId(appId)) // todo: only if tenderly
    const transactionParameters = [
        {
            to: kernel.address,
            from: signerAddress,
            data: unsignedTx.data,
            gas: ethers.utils.hexValue(3000000),
            gasPrice: ethers.utils.hexValue(1),
            save: true,
        },
    ]
    return await engine.simulator!.provider.send("eth_sendTransaction", transactionParameters)
}
