import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import { factoryMapping } from "@constants//"
import "@nomiclabs/hardhat-ethers"
import { ethers, Signer } from "ethers"
import { readFileSync } from "fs"
import { keccak256 } from "ethers/lib/utils"
import { createReleaseApp } from "@scripts/core/create-release-manager"

type UpgradeFromFileArgs = {
    file: string
}

const encodeAppId = (appId: string) => keccak256(ethers.utils.toUtf8Bytes(appId))

task("create-release-manager", "Upgrades a contracts implementation from file bypassing the UpdateManager")
    .addParam("file", "JSON file")
    .setAction(async (args: UpgradeFromFileArgs, hre: HardhatRuntimeEnvironment) => {
        const signers = await hre.ethers.getSigners()
        const { releaseManager, successTeam, sudoWallet } = await hre.getNamedAccounts()
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

            try {
                updateManagerAdderess = await kernel.getUpdateManager()
                isKernelContract = true
            } catch (e) {
                const message = (e as Error).message
                console.log(message)
            }

            if (isKernelContract) {
                try {
                    await createReleaseApp(kernel, releaseManager)
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
