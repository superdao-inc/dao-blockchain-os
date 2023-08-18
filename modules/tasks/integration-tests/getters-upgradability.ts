// It compares getter methods returns b/w before and after for app implementations of kernel addresses supplied.
// Features:
// - currently, it supports getters tests for next apps: KERNEL, ERC721, ADMIN_CONTROLLER, OPEN_SALE
// - no needs to test apps those are not even connected to kernel we check. Thus, it checks that an app connected
// to kernel.
// - on error it generates report in ./tasks/reports folder.
import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import "@nomiclabs/hardhat-ethers"
import { writeFileSync } from "fs"
import { getContract } from "@utils/scripts/getContract"
import { factoryMapping, protocolFactoryMapping } from "@constants/mappings"
import { encodeAppId } from "@utils/scripts/format"
import { AppsIds, ProtocolApps } from "@constants/appsIds"
import { Contract } from "ethers"
import { upgradeAppImpls } from "@scripts/core/upgrade-apps-impls-batch"
import { ContractErrorReports } from "@scripts/interfaces/contractErrorReports"
import { batchCall } from "@utils/scripts/batch-call"
import { ProtocolApp, upgradeProtocolContract } from "@scripts/core/upgrade-protocol-contracts"
import { readProtocolMetasFromFile } from "@utils/scripts/file"
import { filterProtocolContracts } from "@utils/filterApps"
import { Environment } from "@scripts/interfaces/environment"
import { checkStage } from "@utils/scripts/checkStage"
import { emptyArraysCondition } from "@utils/synSugar"
import { conditionalKernels } from "@utils/tasks/upgradabilityTests"
import { readFilterUpdateManagers } from "@scripts/core/read-from-file-filtered"

type UpgradeFromFileArgs = {
    file: string
    apps: string
    batchSize: string
    remoteFetch: boolean
    protocolFile: string
    updateProtocolContracts: boolean
    migrateToBeacon: boolean
    ums: string
}

interface getterResponse {
    method: string
    response: string
}
type GetterResponses = Array<getterResponse>
type GetterResponsesPerApp = Array<GetterResponses>
type GetterResponsesProtocol = Array<GetterResponses>

const kernelsReturnError: ContractErrorReports = []
const kernelsCallError: ContractErrorReports = []
const kernelsUpgradeError: ContractErrorReports = []
const protocolReturnError: ContractErrorReports = []
const protocolCallError: ContractErrorReports = []
const protocolUpgradeError: ContractErrorReports = []
const batchUpgradeErrors: any[] = []

const getterMethodError = (method: string, error: Error) => ({
    method,
    response: `Error happened on one of the getter methods ${(error as Error).message}`,
})

const handleGetter = async (
    getterResponses: GetterResponses,
    func: () => any,
    contract: Contract,
    errorMsg: string
) => {
    try {
        getterResponses.push({
            method: func.toString(),
            response: await func(),
        })
    } catch (error) {
        kernelsCallError.push({
            contractAddress: contract.address,
            message: (error as Error).message,
        })
        return [getterMethodError(errorMsg, error as Error)]
    }

    return getterResponses
}

const getKernelMethods = (kernel: Contract) => [
    () => kernel.kernel(),
    () => kernel.getPermissions(encodeAppId(AppsIds.ADMIN), encodeAppId(AppsIds.ERC721)),
    () => kernel.getPermissions(encodeAppId(AppsIds.KERNEL), encodeAppId(AppsIds.ERC721)),
]

const getERC721Methods = (erc721: Contract) => [() => erc721.name(), () => erc721.symbol(), () => erc721.baseURI()]

const getAdminControllerMethods = (adminController: Contract, admin: string) => [
    () => adminController.adminAddresses(),
    () => adminController.isAdmin(admin),
]

const getOpenSaleMethods = (erc721OpenSale: Contract) => [() => erc721OpenSale.isActive()]

const getContractGetterResponses = async (
    hre: HardhatRuntimeEnvironment,
    contract: Contract,
    appId: keyof typeof AppsIds
) => {
    let getterResponses: GetterResponses = []

    switch (appId) {
        case AppsIds.KERNEL:
            for (const func of getKernelMethods(contract)) {
                getterResponses = [...(await handleGetter(getterResponses, func, contract, "kernelGetterMethod"))]
            }
            break

        case AppsIds.ERC721:
            for (const func of getERC721Methods(contract)) {
                getterResponses = [...(await handleGetter(getterResponses, func, contract, "Erc721GetterMethod"))]
            }
            break

        case AppsIds.ADMIN: {
            const admin = (await contract.adminAddresses())[0]
            for (const func of getAdminControllerMethods(contract, admin)) {
                getterResponses = [...(await handleGetter(getterResponses, func, contract, "AdminControllerMethod"))]
            }
            break
        }

        case AppsIds.ERC721_OPEN_SALE:
            for (const func of getOpenSaleMethods(contract)) {
                getterResponses = [...(await handleGetter(getterResponses, func, contract, "OpenSaleMethod"))]
            }
            break

        default:
            break
    }

    return getterResponses
}

const getUpdateManagerMethods = (updateManager: Contract) => [
    () => updateManager.getLastAppCode(encodeAppId(AppsIds.KERNEL)),
    () => updateManager.getAppCodeHistory(encodeAppId(AppsIds.KERNEL)),
]

const getProtocolGetterResponses = async (
    hre: HardhatRuntimeEnvironment,
    contract: Contract,
    appId: keyof typeof ProtocolApps
) => {
    let getterResponses: GetterResponses = []

    switch (appId) {
        case ProtocolApps.UPDATE_MANAGER:
            for (const func of getUpdateManagerMethods(contract)) {
                getterResponses = [...(await handleGetter(getterResponses, func, contract, "UpdateManagerMethod"))]
            }
            break

        default:
            break
    }

    return getterResponses
}

export async function filterConnectedApps(
    hre: HardhatRuntimeEnvironment,
    kernel: Contract,
    apps: Array<keyof typeof AppsIds>,
    surpressLogs = false
): Promise<Array<keyof typeof AppsIds>> {
    // There's no need to test apps those are not even connected to kernel we check.
    const filtered: Array<keyof typeof AppsIds> = []
    for (const i in apps) {
        const _app = apps[i]
        const appProxyAddress = await kernel.getAppAddress(encodeAppId(_app))
        if (appProxyAddress !== hre.ethers.constants.AddressZero) {
            filtered.push(_app)
        } else {
            if (!surpressLogs) {
                console.log(`Kernel ${kernel.address} is not aware about ${_app}`)
            }
        }
    }
    return filtered
}

type ProtocolAppExtended = {
    contract: Contract
} & ProtocolApp

export async function getProtocolContracts(hre: HardhatRuntimeEnvironment, apps: ProtocolApp[]) {
    const contracts: ProtocolAppExtended[] = []

    for (const app of apps) {
        const contract = await getContract(
            { hreEthers: hre.ethers, deployments: hre.deployments },
            app.contractAddress,
            protocolFactoryMapping[app.app]
        )
        contracts.push({
            contract,
            ...app,
        })
    }

    return contracts
}

type ConnectedApp = { contract: Contract; app: keyof typeof AppsIds }

export async function getContractsKernel(
    hre: HardhatRuntimeEnvironment,
    apps: Array<keyof typeof AppsIds>,
    kernelAddress: string
) {
    console.log("kernel: " + kernelAddress)
    const kernel = await getContract({ hreEthers: hre.ethers }, kernelAddress, factoryMapping.KERNEL)
    console.log(`Filter apps to those kernel aware about...`)

    const filteredAppIds: Array<keyof typeof AppsIds> = await filterConnectedApps(hre, kernel, apps)
    const connectedApps: Array<ConnectedApp> = []

    for (const app of filteredAppIds) {
        const appAddress = await kernel.getAppAddress(encodeAppId(app))
        const contract = await getContract({ hreEthers: hre.ethers }, appAddress, factoryMapping[app])
        connectedApps.push({ contract, app })
    }

    return connectedApps
}

export async function triggerGettersProtocol(hre: HardhatRuntimeEnvironment, apps: ProtocolApp[]) {
    const getterResponsesPerApp: GetterResponsesPerApp = []

    console.log("Getting the protocol contract istances")
    const contracts = await getProtocolContracts(hre, apps)

    console.log(`Getting the getter responses for protocol contracts...`)
    for (const entry of contracts) {
        const { contract, app } = entry
        const getterResponse = await getProtocolGetterResponses(hre, contract, app)
        getterResponsesPerApp.push(getterResponse)
    }

    return { results: getterResponsesPerApp }
}

export async function triggerGetters(
    hre: HardhatRuntimeEnvironment,
    apps: Array<keyof typeof AppsIds>,
    kernelAddress: string
) {
    // Convenience per kernel method to run each in promises.all for bunch of kernels.
    // It compares getter responses for kernel related impl contracts (kernel, erc721) before and after an upgrade.
    // Note, that it filter apps to apps kernel aware about (already connected).
    // On failure it uses global list to push report (for the further writing, logging).
    let getterResponsesPerApp: GetterResponsesPerApp = []

    const connectedApps = await getContractsKernel(hre, apps, kernelAddress)

    if (connectedApps.length === 0) {
        console.log(`No needs to upgrade since kernel ${kernelAddress} is not aware about passed apps ${apps}`)
        return
    }

    const appList = connectedApps.reduce((prev, curr) => prev + curr.app + " ", "").slice(0, -1)
    console.log(`Get responses for apps ${JSON.stringify(appList)} connected to kernel ${kernelAddress}...`)

    const promises = []
    for (const entry of connectedApps) {
        const { app, contract } = entry
        promises.push(getContractGetterResponses(hre, contract, app))
        // getterResponsesPerApp.push(getterResponse)
    }

    getterResponsesPerApp = [...(await Promise.all(promises))]
    return { results: getterResponsesPerApp, kernelAddress }
}

async function protocolCompareGetters(hre: HardhatRuntimeEnvironment, signerAddress: string, apps: ProtocolApp[]) {
    for (const app of apps) {
        if (app.contractAddress === "" || app.contractAddress === "0x") continue
        console.log("Before update:")
        const resultsBefore = await triggerGettersProtocol(hre, apps)

        console.log(`Updating protocol contract ${app.app}`)
        await hre.run("deploy", { tags: protocolFactoryMapping[app.app], write: true })

        await upgradeProtocolContract(
            app.app,
            app.contractAddress,
            signerAddress,
            { hreEthers: hre.ethers, deployments: hre.deployments },
            false
        )

        console.log("After update:")
        const resultsAfter = await triggerGettersProtocol(hre, apps)

        if (!compareStructures(resultsBefore.results, resultsAfter.results)) {
            protocolReturnError.push({
                contractAddress: app.contractAddress,
                message: {
                    before: resultsBefore,
                    after: resultsAfter,
                },
            })
        }
    }
}

async function kernelCompareGetters(
    hre: HardhatRuntimeEnvironment,
    apps: Array<keyof typeof AppsIds>,
    kernelAddresses: string[],
    signerAddress: string,
    batchSize: number
) {
    let _countBefore = 0
    let _countAfter = 0

    function _progress(count: number, suffix?: string) {
        // Want to visualize per kernel progress in promise.all(...).
        console.log(`Progress${!!suffix && suffix}:`, (count * 100) / kernelAddresses.length)
    }

    for (let i = 0; i < kernelAddresses.length; i += batchSize) {
        const kernelsForBatch = kernelAddresses.slice(i, i + batchSize)
        const tasksBeforeUpgrade: any = []
        const tasksAfterUpgrade: any = []

        console.log("before update " + apps.length + "apps")

        for (const j in kernelsForBatch) {
            tasksBeforeUpgrade.push(triggerGetters(hre, apps, kernelsForBatch[j]))
            _progress(++_countBefore, " before upgrade")
        }

        console.log(
            `Compare getter values for upgraded ${apps} of kernels presented` + `for indexes: ${i}-${i + batchSize}...`
        )
        const resultsBeforeUpgrade = await Promise.all(tasksBeforeUpgrade)
        console.log(`Start upgrading ${apps} for kernels ...`)

        try {
            const engine = { hreEthers: hre.ethers, deployments: hre.deployments }
            const batchArgs = await upgradeAppImpls(apps, kernelsForBatch, signerAddress, engine)

            const signer = await hre.ethers.getSigner(signerAddress)
            const { data, contracts } = batchArgs

            console.log(`Kernels to upgrade: ${contracts.length}`)
            const batchCallReturn = await batchCall(signer, engine, contracts, data, 30_000_000, batchSize)

            const { success } = batchCallReturn
            if (!success) {
                batchUpgradeErrors.push({
                    kernels: kernelsForBatch,
                    error: batchCallReturn.errorMessage,
                })
            }
        } catch (e) {
            console.log("Batch failed, no upgrades")
            batchUpgradeErrors.push({
                kernels: kernelsForBatch,
                error: e,
            })
        }

        for (const j in kernelsForBatch) {
            tasksAfterUpgrade.push(triggerGetters(hre, apps, kernelsForBatch[j]))
            _progress(++_countAfter, " after upgrade")
        }
        const resultsAfterUpgrade = await Promise.all(tasksAfterUpgrade)

        for (const j in kernelsForBatch) {
            console.log(`Compare responses for Kernel ${kernelsForBatch[j]}...`)
            for (const i in apps) {
                const app = apps[i]
                if (!!resultsBeforeUpgrade?.[j]?.results && !!resultsAfterUpgrade?.[j]?.results) {
                    if (!compareStructures(resultsBeforeUpgrade[j].results[i], resultsAfterUpgrade[j].results[i])) {
                        kernelsReturnError.push({
                            contractAddress: resultsBeforeUpgrade[j].kernelAddress,
                            message: {
                                app,
                                before: resultsBeforeUpgrade[j].results[i],
                                after: resultsAfterUpgrade[j].results[i],
                            },
                        })
                    }
                }
            }
        }
    }
}

function compareStructures(
    beforeResponses: GetterResponses | GetterResponsesProtocol,
    afterResponses: GetterResponses | GetterResponsesProtocol
): boolean {
    return JSON.stringify(afterResponses) === JSON.stringify(beforeResponses)
}

const formReports = (errors: Array<any[]>, errorNames: string[]) => {
    errors.forEach((err, i) => {
        writeFileSync(
            `./modules/tasks/reports/errors.integration-test.${errorNames[i]}.json`,
            JSON.stringify(err, null, 4)
        )
    })
}

task(
    "getters-upgradability",
    "It compares getter methods returns b/w before and after an upgrade implementation of kernel " +
        "addresses. On error it generates report in ./tasks/reports folder. "
)
    .addOptionalParam(
        "file",
        "JSON file with kernel addresses with format, e.g. " +
            '[{"contractAddress" : "0xAb9f24AcF3987412898e28b31CEc6a4Daee21D8E"}]'
    )
    .addOptionalParam(
        "protocolFile",
        'JSON file with contract addresses, e.g. [{"contractAddress" : "0xAb9f24AcF3987412898e28b31CEc6a4Daee21D8E", "app" : "UPDATE_MANAGER"}]'
    )
    .addParam("apps", "AppsIds to update, e.g. KERNEL,SUDO")
    .addParam("batchSize", "Specify batch size to batch kernels passed", "100")
    .addFlag("remoteFetch", "Specify if you want to fetch kernels from the remote. File param would not be used.")
    .addFlag("migrateToBeacon", "Migrate all kernels to support UpgradableBeacon")
    .addOptionalParam("ums", "UpdateManagers file")
    .setAction(async (args: UpgradeFromFileArgs, hre: HardhatRuntimeEnvironment) => {
        const _batchSize = parseInt(args.batchSize, 10)
        const env = checkStage(hre) ? Environment.STAGE : Environment.MAINNET
        const kernelAddresses = await conditionalKernels(!!args?.remoteFetch, env, args.file)

        const apps = args.apps.split(",") as Array<keyof typeof AppsIds>
        const { releaseManager } = await hre.getNamedAccounts()

        if (args?.protocolFile) {
            const contractMetas = await readProtocolMetasFromFile(args.protocolFile)
            const protocolApps = filterProtocolContracts(contractMetas)
            await protocolCompareGetters(hre, releaseManager, protocolApps)
            const updateManagerAddresses = readFilterUpdateManagers(env, args?.ums)

            if (args?.migrateToBeacon) {
                await hre.run("deploy-beacons", { ums: updateManagerAddresses.join(",") })
            }
        }

        await kernelCompareGetters(hre, apps, kernelAddresses, releaseManager, _batchSize)
        const errors = [
            kernelsReturnError,
            kernelsCallError,
            kernelsUpgradeError,
            protocolReturnError,
            protocolCallError,
            protocolUpgradeError,
            batchUpgradeErrors,
        ]

        const errorNames = [
            "kernelsReturnError",
            "kernelsCallError",
            "kernelsUpgradeError",
            "protocolReturnError",
            "protocolCallError",
            "protocolUpgradeError",
            "batchUpgradeErrors",
        ]

        if (emptyArraysCondition(errors)) {
            console.log("All tests passed without errors")
        } else {
            console.log("Errors happened, writing reports to ./tasks/reports folder...")
            formReports(errors, errorNames)
        }
    })
