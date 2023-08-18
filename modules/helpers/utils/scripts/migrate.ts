import { filterConnectedApps } from "@tasks/integration-tests/getters-upgradability"
import { AppsIds } from "@constants/appsIds"
import { Contract } from "ethers"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { encodeAppId } from "@utils//"
import { factoryMapping } from "@constants/mappings"
import { ChainIds } from "@constants/networks"
import { getImpersonatedSignerWithEths } from "@scripts/hardhat/impersonateAccountWithEths"

export const logEngine = (message: string, logger?: any) => {
    if (logger) {
        logger.log(`${message}\n`)
    } else {
        console.log(message)
    }
}

type BeaconMigrationError = {
    kernel: string
    app: string
    error: any
}

export const migrateKernelToBeacon = async (
    hre: HardhatRuntimeEnvironment,
    kernel: Contract,
    useBatch: boolean,
    ums: string[],
    logger?: any
) => {
    const contracts: Contract[] = []
    const data: string[] = []

    const handleBatchPrepare = (contract: Contract, tx: any) => {
        contracts.push(contract)
        data.push(tx.data)
    }

    const appsToCheck = [
        AppsIds.KERNEL,
        AppsIds.ADMIN,
        AppsIds.ERC721,
        AppsIds.ERC721_OPEN_SALE,
        AppsIds.ERC721_WHITELIST_SALE,
    ]

    const { chainId } = await hre.ethers.provider.getNetwork()
    const { releaseManager } = await hre.getNamedAccounts()

    const apps = await filterConnectedApps(hre, kernel, appsToCheck as Array<keyof typeof AppsIds>, true)
    const semver = await kernel.__semver()
    logEngine(`semver: ${semver}`, logger)
    const um = await kernel.getUpdateManager()
    logEngine(`um: ${um}`, logger)

    const errors: BeaconMigrationError[] = []
    const rmSigner = await hre.ethers.getSigner(releaseManager)
    let signer = rmSigner

    if (semver === "v1.1.0" && ums.includes(um)) {
        for (const app of apps) {
            logEngine(`migrating ${app} to beacon...`, logger)
            if (chainId === Number(ChainIds.hardhat)) {
                signer = await getImpersonatedSignerWithEths(hre.ethers, releaseManager)
            }
            try {
                if (!useBatch) {
                    const tx = await kernel.connect(signer).migrateApp(encodeAppId(app))
                    logEngine(`tx hash: ${tx.hash}`, logger)
                    const receipt = await tx.wait(1)
                    // console.log('logs:')
                    // console.log(receipt.logs)
                    // console.log('events:')
                    // console.log(receipt.events)
                    // const proxyAddress = await kernel.getAppAddress(encodeAppId(app))
                    // const proxy = await hre.ethers.getContractAt(factoryMapping[app], proxyAddress)
                    // const proxyImpl = await proxy.implementation()
                    // console.log('proxy impl: ' + proxyImpl)
                    logEngine("success", logger)
                } else {
                    handleBatchPrepare(kernel, await kernel.populateTransaction.migrateApp(encodeAppId(app)))
                }
            } catch (error) {
                logEngine(`migration failed for app ${app}, kernel ${kernel.address}`, logger)
                errors.push({ kernel: kernel.address, app, error })
            }
        }

        return { errors, contracts, data }
    }

    logEngine("app not suited for migration, skipping...", logger)
    return { errors, contracts, data }
}
