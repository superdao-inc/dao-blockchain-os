import { AppsIds, factoryMapping } from "@constants//"
import { AppsIds as AppsIdsExtended } from "@utils/const"
import { Contract, ethers } from "ethers"
import "hardhat-deploy/dist/src/type-extensions"
import { encodeAppId } from "@utils/scripts/format"
import { HardhatSimulator } from "../clients/hardhat/hardhatSimulator"
import { ChainIds } from "@constants/networks"
import { Engine } from "../interfaces/engine"
import { getContract } from "@utils/scripts/getContract"
import { SemVer } from "semver"
import { createReleaseApp } from "./create-release-manager"
import { getImpersonatedSignerWithEths } from "@scripts/hardhat/impersonateAccountWithEths"
import type cliProgress from "cli-progress"
import { logEngine } from "@utils/scripts/migrate"

export const loggerLog = (...args: any[]) => args.reduce((curr, prev) => prev + " " + curr.toString(), "").slice(0, -1)

export type UpgradeError = {
    kernel: string
    error?: Error | unknown
}

export async function upgradeAppImplsSimplified(
    apps: Array<string>,
    kernelAddresses: Array<string>,
    signerAddress: string,
    engine: Engine
) {
    const data: string[] = []
    const contracts: Contract[] = []
    const contractsWithoutPermission: UpgradeError[] = []

    for (let i = 0; i < kernelAddresses.length; i++) {
        const kernelAddress = kernelAddresses[i]

        const kernel = await engine.hreEthers.getContractAt("Kernel", kernelAddress)
        logEngine(loggerLog("\n\n"))
        logEngine(loggerLog(`==Processing kernel ${kernelAddress}===`))

        for (let j = 0; j < apps.length; j++) {
            try {
                await kernel.__semver()
                const hasPermission = await kernel.hasPermission(signerAddress, kernel.address, 0)
                if (hasPermission) {
                    const appId: keyof typeof AppsIds = apps[j] as keyof typeof AppsIds
                    logEngine(loggerLog(`Constructung tx for upgrading app ${factoryMapping[appId]} to a new address`))
                    data.push((await kernel.populateTransaction.upgradeApp(encodeAppId(appId))).data)
                    contracts.push(kernel)
                } else {
                    logEngine(loggerLog(`Kernel - ${kernel.address} doesn't have permission`))
                    contractsWithoutPermission.push({ kernel: kernel.address })
                }
            } catch (error) {
                logEngine(loggerLog(`Kernel - ${kernel.address} failed`))
                contractsWithoutPermission.push({ kernel: kernel.address, error })
            }
        }
    }

    return { data, contracts, contractsWithoutPermission }
}

export async function upgradeAppImpls(
    apps: Array<string>,
    kernelAddresses: Array<string>,
    signerAddress: string,
    engine: Engine,
    raiseOnError = false,
    progress?: cliProgress.SingleBar,
    logger?: any
) {
    let data: string[] = []
    let contracts: Contract[] = []
    let contractsWithoutPermission: UpgradeError[] = []

    for (const kernelAddress of kernelAddresses) {
        progress?.increment()
        if (kernelAddress === "" || kernelAddress === "0x") continue
        logEngine(loggerLog("Processing kernel", kernelAddress), logger)

        const kernel = await getContract(engine, kernelAddress, factoryMapping.KERNEL)
        let isKernelContract = false
        let updateManagerAddress = "undefined"
        let updateManager
        let updateManagerOwnerAddress
        let isKernelAdmin = false

        try {
            updateManagerAddress = await kernel.getUpdateManager()
            logEngine(loggerLog("Update manager address (got from kernel)", updateManagerAddress), logger)
            if (updateManagerAddress !== engine.hreEthers.constants.AddressZero) {
                isKernelContract = true
            }
        } catch (e) {
            if (raiseOnError) {
                throw e
            }
            const message = (e as Error).message
            logEngine(loggerLog(message), logger)
            contractsWithoutPermission.push({
                kernel: kernel.address,
                error: e,
            })
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
            contractsWithoutPermission.push({
                kernel: kernel.address,
                error: e,
            })
        }

        if (isKernelContract) {
            try {
                // as UpdateManager;  // todo can not use coz of hardhat task
                updateManager = await getContract(engine, updateManagerAddress, factoryMapping.UPDATE_MANAGER)
                updateManagerOwnerAddress = await updateManager.owner()
                logEngine(loggerLog("Update manager owner", updateManagerOwnerAddress), logger)
                const callForwarderAddr = (await engine.deployments.get("CallForwarder")).address
                const trustedForwarder = await kernel.isTrustedForwarder(callForwarderAddr)
                logEngine("trustedForwarder: ", logger)
                logEngine(loggerLog(trustedForwarder), logger)
                logEngine(`callForwarderAddr: ${callForwarderAddr}`, logger)
                const batchCallArgs = await upgradeApps(
                    engine,
                    apps,
                    updateManager,
                    isKernelAdmin,
                    kernel,
                    signerAddress,
                    raiseOnError,
                    logger
                )
                data = data.concat(batchCallArgs.data)
                contracts = contracts.concat(batchCallArgs.contracts)
                contractsWithoutPermission = contractsWithoutPermission.concat(batchCallArgs.contractsWithoutPermission)
            } catch (e) {
                if (raiseOnError) {
                    throw e
                }
                const message = (e as Error).message
                logEngine(loggerLog("received an error: " + message), logger)
                contractsWithoutPermission.push({
                    kernel: kernel.address,
                    error: e,
                })
            }
        } else {
            logEngine(loggerLog("Not a valid kernel contract"), logger)
        }
    }

    return { data, contracts, contractsWithoutPermission }
}

async function upgradeApps(
    engine: Engine,
    apps: Array<string>,
    updateManager: any,
    isKernelAdmin: boolean,
    kernel: any,
    signerAddress: string,
    raiseOnError: boolean,
    logger?: any
) {
    let data: string[] = []
    let contracts: Contract[] = []
    let contractsWithoutPermission: UpgradeError[] = []

    for (let i = 0; i < apps.length; i++) {
        const appId: keyof typeof AppsIds = apps[i] as keyof typeof AppsIds
        logEngine(loggerLog(updateManager.address), logger)
        const newImplAddress = await updateManager.getLastAppCode(encodeAppId(appId))

        if (isKernelAdmin) {
            logEngine(loggerLog(`Upgrading app ${factoryMapping[appId]} to a new address ${newImplAddress}...`), logger)
            const batchCallArgs = await upgradeAppAndMigrate(
                engine,
                kernel,
                appId,
                newImplAddress,
                signerAddress,
                raiseOnError,
                logger
            )
            data = data.concat(batchCallArgs.data)
            contracts = contracts.concat(batchCallArgs.contracts)
            contractsWithoutPermission = contractsWithoutPermission.concat(batchCallArgs.contractsWithoutPermission)
        } else {
            logEngine(loggerLog("Not a kernel admin of", kernel.address), logger)
        }
    }

    logEngine(loggerLog("inside upgradeApps: " + contracts.length), logger)
    return { data, contracts, contractsWithoutPermission }
}

// type UnbatchableApp = { appId: keyof typeof AppsIds; kernel: any; appProxy: any }

async function upgradeAppAndMigrate(
    engine: Engine,
    kernel: any,
    appId: keyof typeof AppsIds,
    newImplAddress: string,
    signerAddress: string,
    raiseOnError: boolean,
    logger?: any
) {
    const data: string[] = []
    const contracts: Contract[] = []
    const contractsWithoutPermission: UpgradeError[] = []
    const appProxyAddress = await kernel.getAppAddress(encodeAppId(appId))

    if (appProxyAddress === ethers.constants.AddressZero) {
        logEngine(loggerLog("App not connected, skipping"), logger)
        return { data, contracts, contractsWithoutPermission }
    }

    let appProxy = (await getContract(engine, appProxyAddress, factoryMapping[appId])) as Contract
    const { chainId } = await engine.hreEthers.provider.getNetwork()

    if (chainId === Number(ChainIds.hardhat)) {
        logEngine(
            loggerLog("This is hardhat network, releaseManager account will be impersonated and provided with eths..."),
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
        logEngine(loggerLog("implementation() method not supported, skipping check"), logger)
        return { data, contracts, contractsWithoutPermission }
    }

    if (currentImplAddress !== newImplAddress) {
        const permissions = 0

        let appSemVer = new SemVer("0.0.0")
        try {
            appSemVer = new SemVer(await appProxy.__semver())
        } catch (e) {
            contractsWithoutPermission.push({
                kernel: kernel.address,
                error: e,
            })
        }
        logEngine(loggerLog("SemVer:", appSemVer.raw), logger)

        if (appProxyAddress !== engine.hreEthers.constants.AddressZero) {
            if (appId === AppsIds.ERC721 && appSemVer.compare("1.0.2") < 0) {
                logEngine(loggerLog("Unbatchable app found, upgrading manually..."), logger)
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
                logEngine(loggerLog("Unbatchable app found, upgrading manually..."), logger)
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
                    loggerLog(
                        "Migration successful for",
                        appId,
                        "with token address",
                        await appProxy.tokenSaleAddress()
                    ),
                    logger
                )
            } else {
                logEngine(loggerLog(`Upgrading ${appId} in kernel...\n`), logger)
                const tx = await getUpgradeAppInKernelTx(engine, kernel, signerAddress, appId)
                data.push(tx.data)
                contracts.push(kernel)
            }
        } else {
            logEngine(loggerLog("App not connected to Kernel"), logger)
        }
    } else {
        logEngine(loggerLog("Current proxy refers to the last implementation, no upgrades"), logger)
        logEngine(loggerLog(`Current impl address: ${currentImplAddress}`), logger)
    }

    return { data, contracts, contractsWithoutPermission }
}

// todo: no Kernel type coz of hardhat task
async function getUpgradeAppInKernelTx(engine: Engine, kernel: any, signerAddress: string, appId: string) {
    // todo: tenderly specific only: it is better to move logic of transaction sending method into simulator class
    const unsignedTx = await kernel.populateTransaction.upgradeApp(encodeAppId(appId))
    return unsignedTx
}

async function sendTx(from: string, to: string, tx: any, engine: Engine) {
    const signerAddress = from

    if (engine.hreEthers) {
        // signerAddress should be impersonated or passed to hardhat directly through private
        // if we work on mainnet
        const { chainId } = await engine.hreEthers.provider.getNetwork()
        if (chainId === Number(ChainIds.hardhat)) {
            logEngine(loggerLog(`In hardhat node impersonated account ${signerAddress} will be used...`))
            const simulatorHardhat: HardhatSimulator = new HardhatSimulator({ rpcProvider: engine.hreEthers.provider })
            await simulatorHardhat.impersonateAccount(signerAddress)
        }

        // const _ = await engine.hreEthers.getSigner(signerAddress)
    }

    const transactionParameters = [
        {
            to,
            from,
            data: tx.data,
            gas: ethers.utils.hexValue(3_000_000),
            gasPrice: ethers.utils.hexValue(1),
            save: true,
        },
    ]
    return await engine.simulator!.provider.send("eth_sendTransaction", transactionParameters)
}

// todo: no Kernel type coz of hardhat task
async function upgradeAppInKernel(engine: Engine, kernel: any, signerAddress: string, appId: string) {
    if (engine.hreEthers) {
        // signerAddress should be impersonated or passed to hardhat directly through private
        // if we work on mainnet
        const { chainId } = await engine.hreEthers.provider.getNetwork()
        if (chainId === Number(ChainIds.hardhat)) {
            logEngine(loggerLog(`In hardhat node impersonated account ${signerAddress} will be used...`))
            const simulatorHardhat: HardhatSimulator = new HardhatSimulator({ rpcProvider: engine.hreEthers.provider })
            await simulatorHardhat.impersonateAccount(signerAddress)
        }

        const signer = await engine.hreEthers.getSigner(signerAddress)
        const kernelWithSigner = kernel.connect(signer)
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
