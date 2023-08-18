import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import { encodeAppId } from "@utils//"
import { AppsIds } from "@constants//"
import "@nomiclabs/hardhat-ethers"
import inquirer from "inquirer"
import type { Signer } from "ethers"

type UpgradeArgs = {
    appid: keyof typeof AppsIds
    kernel: string
}

task("manager-upgrade-app", "Upgrades a contract's implementation using the UpdateManager")
    .addParam("kernel", "The kernel's address")
    .addParam("appid", "Refer to the AppsIds library")
    .setAction(async (args: UpgradeArgs, hre: HardhatRuntimeEnvironment) => {
        const kernel = await hre.ethers.getContractAt("Kernel", args.kernel)
        const signers = await hre.ethers.getSigners()
        const { chainId } = await hre.ethers.provider.getNetwork()
        let signer: Signer = signers[0]

        if (chainId === hre.network.config.chainId) {
            const SUDO = process?.env.SUDO_WALLET_ADDRESS || signers[0].address

            await hre.network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [SUDO],
            })

            await hre.network.provider.send("hardhat_setBalance", [SUDO, hre.ethers.utils.parseEther("100")])
            signer = await hre.ethers.getSigner(SUDO)
            const signerAddress = await signer.getAddress()
            console.log(`Upgrading as: ${signerAddress}`)
        }

        if (!AppsIds?.[args?.appid]) {
            console.log(`AppId does not exist. Possible options: ${Object.keys(AppsIds)}`)
            return
        }

        const appId = encodeAppId(AppsIds[args.appid])
        const updateManagerAddress = await kernel.getUpdateManager()
        const updateManager = await hre.ethers.getContractAt("UpdateManager", updateManagerAddress)
        const codes = await updateManager.getAppCodeHistory(appId)
        const lastAppCode = await updateManager.getLastAppCode(appId)

        if (codes.length === 0) {
            console.log("no implementations found for the app")
            return
        }

        const searchCode = await inquirer.prompt([
            {
                type: "confirm",
                name: "yes",
                message: "Do you want to search for the implementation?",
                default: false,
            },
        ])

        if (searchCode.yes) {
            const codeSelection = await inquirer.prompt([
                {
                    type: "list",
                    name: "code",
                    message: "Available implementations:",
                    choices: codes,
                },
            ])

            if (codeSelection.code === lastAppCode) {
                const approval = await inquirer.prompt([
                    {
                        type: "confirm",
                        name: "yes",
                        message: "You chose the same implementation as the current one. Procceed?",
                        default: false,
                    },
                ])

                if (!approval.yes) {
                    return
                }
            }

            const tx = await kernel.connect(signer).upgradeAppImpl(appId, codeSelection.code)
            await tx.wait()
            console.log(`App upgraded to ${codeSelection.code}`)
        } else {
            const tx = await kernel.connect(signer).upgradeApp(appId)
            await tx.wait()
            console.log(`App upgraded to the latest version`)
        }
    })
