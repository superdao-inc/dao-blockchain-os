import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import { AppsIds, factoryMapping } from "@constants//"
import "@nomiclabs/hardhat-ethers"
import { Contract, ethers, Signer } from "ethers"
import { readFileSync } from "fs"
import { boolean } from "hardhat/internal/core/params/argumentTypes"
import { keccak256 } from "ethers/lib/utils"

type UpgradeFromFileArgs = {
    file: string
    resetsudo: boolean
}

const encodeAppId = (appId: string) => keccak256(ethers.utils.toUtf8Bytes(appId))

task("reset-sudo", "Upgrades a contracts implementation from file bypassing the UpdateManager")
    .addParam("file", "JSON file")
    .addParam("apps", "Refer to the AppsIds library")
    .addParam("resetsudo", "Reset SUDO to SuccessTeam", false, boolean, true)
    .setAction(async (args: UpgradeFromFileArgs, hre: HardhatRuntimeEnvironment) => {
        const signers = await hre.ethers.getSigners()
        const { successTeam, sudoWallet } = await hre.getNamedAccounts()
        const { chainId } = await hre.ethers.provider.getNetwork()
        const { file } = args
        let signer: Signer = signers[0]
        const signerAddress = await signer.getAddress()
        const fileD = readFileSync(file, "utf-8")
        const json = JSON.parse(fileD)

        if (chainId === hre.network.config.chainId) {
            signer = await makeSUDOSigner(hre, signer, sudoWallet)
        }

        for (const entry of json) {
            const kernelAddress = entry.contractAddress
            if (kernelAddress === "" || kernelAddress === "0x") continue
            console.log("Processing kernel", kernelAddress)
            const kernel = await hre.ethers.getContractAt(factoryMapping.KERNEL, entry.contractAddress)
            const isContract = (await hre.ethers.provider.getCode(kernel.address)) !== "0x"
            let isKernelContract = false
            let updateManagerAdderess = "undefined"
            let updateManager
            let updateManagerOwner
            let isKernelAdmin = false

            try {
                updateManagerAdderess = await kernel.getUpdateManager()
                console.log(updateManagerAdderess)
                isKernelContract = true
            } catch (e) {
                const message = (e as Error).message
                console.log(message)
            }
            try {
                isKernelAdmin = await kernel.hasPermission(signerAddress, kernel.address, 0)
            } catch (e) {
                const message = (e as Error).message
                console.log(message)
            }

            if (isKernelContract) {
                try {
                    updateManager = await hre.ethers.getContractAt(factoryMapping.UPDATE_MANAGER, updateManagerAdderess)
                    updateManagerOwner = await updateManager.owner()
                    if (updateManagerOwner === signerAddress) {
                        await resetSUDOToSuccessTeam(isKernelAdmin, kernel, successTeam)
                    } else {
                        console.log("Not a Update Manager owner ", updateManagerOwner)
                    }
                } catch (e) {
                    const message = (e as Error).message
                    console.log(message)
                }
            } else {
                console.log("Not a valid kernel contract")
            }
        }
    })

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

async function resetSUDOToSuccessTeam(isKernelAdmin: boolean, kernel: any, successTeam: string) {
    if (isKernelAdmin) {
        console.log("Reseting SUDO")
        const addressSUDO = kernel.getAppAddress(encodeAppId(AppsIds.SUDO))
        if (addressSUDO !== successTeam) {
            const tx = await kernel.resetApp(encodeAppId(AppsIds.SUDO), successTeam, false)
            await tx.wait(1)
        }
    } else {
        console.log("Not a kernel admin")
    }
}
