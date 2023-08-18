import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import { factoryMapping, AppsIds } from "@constants//"
import "@nomiclabs/hardhat-ethers"
import { ethers, Signer } from "ethers"
import { getImpersonatedSignerWithEths } from "@scripts/hardhat/impersonateAccountWithEths"
import { ChainIds } from "@constants/networks"
import { fundHardhatAccount } from "@scripts/hardhat/fundAccount"
import { readFilterUpdateManagers } from "@scripts/core/read-from-file-filtered"
import { checkStage } from "@utils/scripts/checkStage"
import { Environment } from "@scripts/interfaces/environment"
import { filterApps } from "@utils/filterApps"
import { encodeAppId } from "@utils/econdeAppId"

type UpdateBeaconsArgs = {
    updateManagersFile: string
    apps: string
    forceDeploy: boolean
}

task("update-beacons", "Deploys UpgradableBeacons with UpdateManager")
    .addParam("updateManagersFile", "UpdateManagers file")
    .addParam("apps", "Apps to update")
    .addFlag("forceDeploy", "Force new deployment")
    .setAction(async (args: UpdateBeaconsArgs, hre: HardhatRuntimeEnvironment) => {
        const env = checkStage(hre) ? Environment.STAGE : Environment.MAINNET
        const updateManagerAddresses = readFilterUpdateManagers(env, args.updateManagersFile)
        const signers = await hre.ethers.getSigners()
        const { releaseManager } = await hre.getNamedAccounts()
        const { chainId } = await hre.ethers.provider.getNetwork()
        let signer: Signer = signers[0]

        if (chainId === Number(ChainIds.hardhat)) {
            console.log("This is hardhat network, sudoWallet account will be impersonated and provided with eths...")
            await fundHardhatAccount(hre, (await hre.ethers.getSigners())[0].address, "100")
            signer = await getImpersonatedSignerWithEths(hre.ethers, releaseManager)
        }
        const signerAddress = await signer.getAddress()
        console.log(`Updating beacons as: ${await signer.getAddress()}`)

        const apps: Array<keyof typeof AppsIds> = filterApps(args?.apps || [])

        if (args?.forceDeploy) {
            for (const app of apps) {
                console.log(`deploying app ${app}`)
                await hre.run("deploy", { tags: factoryMapping[app] })
            }
        }

        for (const um of updateManagerAddresses) {
            console.log("Deploying beacons to UpdateManager", um)
            const updateManager = await hre.ethers.getContractAt(factoryMapping.UPDATE_MANAGER, um, signer)
            const updateManagerOwner = await updateManager.owner()

            if (updateManagerOwner === signerAddress) {
                for (const app of apps) {
                    const appId = encodeAppId(app)
                    const beacon = await updateManager.getBeacon(appId)
                    if (beacon !== ethers.constants.AddressZero) {
                        console.log(`upgrading beacon for ${app} @um ${um}`)
                        const impl = await updateManager.getLastAppCode(appId)
                        const tx = await updateManager.updateBeacon(appId, impl)
                        await tx.wait(1)
                        console.log("success...")
                    } else {
                        console.log(`Beacon for app ${app} @um ${um} not deployed`)
                    }
                }
            } else {
                console.log("Not a Update Manager", um, "owner", updateManagerOwner, ". Current signer:", signerAddress)
            }
        }
    })
