import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import { AppsIds, factoryMapping } from "@constants//"
import "@nomiclabs/hardhat-ethers"
import { ethers, Signer } from "ethers"
import { readFileSync } from "fs"
import { Interface, keccak256 } from "ethers/lib/utils"
import EthersAdapter from "@gnosis.pm/safe-ethers-lib"
import Safe from "@gnosis.pm/safe-core-sdk"
import { MetaTransactionData, OperationType } from "@gnosis.pm/safe-core-sdk-types"

type UpgradeFromFileArgs = {
    file: string
}
const iface = new Interface([
    "function connectApp(bytes32,address,bool)",
    "function addPermission(bytes32,bytes32,uint8)",
])
const encodeAppId = (appId: string) => keccak256(ethers.utils.toUtf8Bytes(appId))

let transactionsConnectApp: MetaTransactionData[] = []
let transactionsAddPermission: MetaTransactionData[] = []
let connectIndex = 0
let permissionIndex = 0

const bulk = 100000

task("gnosis-create-release-manager", "Upgrades a contracts implementation from file bypassing the UpdateManager")
    .addParam("file", "JSON file")
    .setAction(async (args: UpgradeFromFileArgs, hre: HardhatRuntimeEnvironment) => {
        const signers = await hre.ethers.getSigners()
        const { releaseManager, successTeam, sudoWallet } = await hre.getNamedAccounts()
        const { chainId } = await hre.ethers.provider.getNetwork()
        const { file } = args
        let signer: Signer = signers[0]

        const fileD = readFileSync(file, "utf-8")
        const json = JSON.parse(fileD)

        if (chainId === hre.network.config.chainId) {
            signer = await makeSUDOSigner(hre, signer, sudoWallet)
        }

        for (let i = 0; i < json.length; i++) {
            const entry = json[i]
            const kernelAddress = entry.contractAddress
            if (kernelAddress === "" || kernelAddress === "0x") continue
            console.log("Processing kernel", kernelAddress)
            const kernel = await hre.ethers.getContractAt(factoryMapping.KERNEL, entry.contractAddress)
            let isKernelContract = false
            try {
                isKernelContract = true
            } catch (e) {
                const message = (e as Error).message
                console.log(message)
            }
            let hasKernelAccess = false
            try {
                hasKernelAccess = await kernel.hasPermission(successTeam, kernel.address, 0)
            } catch {}
            if (isKernelContract && hasKernelAccess) {
                try {
                    const addressRM = await kernel.getAppAddress(encodeAppId(AppsIds.RELEASE_MANAGER))
                    if (addressRM === "0x0000000000000000000000000000000000000000") {
                        connectApp(kernelAddress, releaseManager)
                    } else {
                        console.log("Release manager app have already been created")
                    }
                    await addPermission(kernel, AppsIds.KERNEL, releaseManager)
                    await addPermission(kernel, AppsIds.ERC721, releaseManager)
                    await addPermission(kernel, AppsIds.ERC721_OPEN_SALE, releaseManager)
                    await addPermission(kernel, AppsIds.ERC721_WHITELIST_SALE, releaseManager)
                } catch (e) {
                    const message = (e as Error).message
                    console.log(message)
                }
            } else {
                console.log("Not a valid kernel contract or no access")
            }

            if ((i + 1) % bulk === 0 || i + 1 === json.length) {
                await createReleaseApp(hre, signer, successTeam)
                transactionsConnectApp = []
                transactionsAddPermission = []
                connectIndex = 0
                permissionIndex = 0
            }
        }
    })

async function addPermission(kernel: any, appId: string, releaseManager: string) {
    const isExist = (await kernel.getAppAddress(encodeAppId(appId))) !== "0x0000000000000000000000000000000000000000"
    let isPerm = false
    try {
        isPerm = await kernel.hasPermission(releaseManager, await kernel.getAppAddress(encodeAppId(appId)), 0)
    } catch (e) {}
    if (!isPerm && isExist) {
        const data = iface.encodeFunctionData("addPermission", [
            encodeAppId(AppsIds.RELEASE_MANAGER),
            encodeAppId(appId),
            0,
        ])
        transactionsAddPermission[permissionIndex++] = {
            to: kernel.address,
            data,
            value: "0",
            operation: OperationType.Call,
        }
        console.log("Adding permissions to", appId)
    } else if (isPerm) {
        console.log("Permissioms to", appId, "already set")
    } else {
        console.log("App", appId, "does not exist")
    }
}

function connectApp(kernelAddress: any, releaseManager: string) {
    const data = iface.encodeFunctionData("connectApp", [encodeAppId(AppsIds.RELEASE_MANAGER), releaseManager, false])
    transactionsConnectApp[connectIndex++] = {
        to: kernelAddress,
        data,
        value: "0",
        operation: OperationType.Call,
    }
}

async function makeSUDOSigner(hre: HardhatRuntimeEnvironment, signer: Signer, sudoWallet: string) {
    const SUDO = sudoWallet || (await signer.getAddress())

    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [SUDO],
    })

    await hre.network.provider.send("hardhat_setBalance", [SUDO, hre.ethers.utils.parseEther("100")])
    signer = await hre.ethers.getSigner(SUDO)

    console.log(`Upgrading as: ${await signer.getAddress()}`)
    return signer
}

async function createReleaseApp(hre: HardhatRuntimeEnvironment, signer: Signer, successTeam: string) {
    const safeOwner = signer
    const ethAdapter = new EthersAdapter({
        ethers: hre.ethers,
        signer: safeOwner,
    })
    const safeSdk = await Safe.create({ ethAdapter, safeAddress: successTeam })

    if (transactionsConnectApp.length > 0) {
        try {
            console.log("Creating release manager app")
            const safeTransactionConnectApp = await safeSdk.createTransaction(transactionsConnectApp, {
                safeTxGas: 500000,
            })
            const txSafe = await safeSdk.executeTransaction(safeTransactionConnectApp)
            const tx = await txSafe.transactionResponse?.wait(1)
            console.log(tx)
        } catch (e) {
            console.log("Failed creating release manager app", e)
        }
    }

    if (transactionsAddPermission.length > 0) {
        try {
            console.log("Adding permissions to release manager app")
            const safeTransactionAddPermission = await safeSdk.createTransaction(transactionsAddPermission, {
                safeTxGas: 500000,
            })
            const txSafe = await safeSdk.executeTransaction(safeTransactionAddPermission)
            const tx = await txSafe.transactionResponse?.wait(1)
            console.log(tx)
        } catch (e) {
            console.log("Failed adding permissions to release manager app", e)
        }
    }
}
