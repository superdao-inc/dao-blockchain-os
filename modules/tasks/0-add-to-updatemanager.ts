import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import { AppsIds, factoryMapping } from "@constants//"
import "@nomiclabs/hardhat-ethers"
import { Signer } from "ethers"
import { getImpersonatedSignerWithEths } from "@scripts/hardhat/impersonateAccountWithEths"
import { ChainIds } from "@constants/networks"
import { encodeAppId } from "@utils/scripts/format"
import { fundHardhatAccount } from "@scripts/hardhat/fundAccount"
import { filterApps } from "@utils/filterApps"

type UpgradeFromFileArgs = {
    ums: string
    apps: string
    noDeploy: boolean
    isStage: boolean
}

task("add-to-updatemanager", "Upgrades a contracts implementation from file bypassing the UpdateManager")
    .addParam("ums")
    .addOptionalParam("apps", "")
    .addFlag("noDeploy", "Wehter to deploy or not")
    .setAction(async (args: UpgradeFromFileArgs, hre: HardhatRuntimeEnvironment) => {
        const signers = await hre.ethers.getSigners()
        const { releaseManager } = await hre.getNamedAccounts()
        const { chainId } = await hre.ethers.provider.getNetwork()
        const ums = args.ums.split(",")
        const apps = filterApps(args?.apps || [])
        let signer: Signer = signers[0]

        if (chainId === Number(ChainIds.hardhat)) {
            console.log("This is hardhat network, sudoWallet account will be impersonated and provided with eths...")
            await fundHardhatAccount(hre, (await hre.ethers.getSigners())[0].address, "100")
            signer = await getImpersonatedSignerWithEths(hre.ethers, releaseManager)
        }
        const signerAddress = await signer.getAddress()
        console.log(`Upgrading as: ${await signer.getAddress()}`)

        for (const um of ums) {
            console.log("Adding implementations to UpdateManager", um)
            const updateManager = await hre.ethers.getContractAt(factoryMapping.UPDATE_MANAGER, um, signer)
            const updateManagerOwner = await updateManager.owner()
            if (updateManagerOwner === signerAddress) {
                for (let i = 0; i < apps.length; i++) {
                    const appId: keyof typeof AppsIds = apps[i] as keyof typeof AppsIds

                    console.log("Upgrading app", factoryMapping[appId])
                    const implAddress = await updateManager.getLastAppCode(encodeAppId(appId))
                    if (!args?.noDeploy) {
                        await hre.run("deploy", { tags: factoryMapping[appId], write: true })
                    }

                    const newContract = await hre.deployments.get(factoryMapping[appId])
                    console.log("Upgrading app ", factoryMapping[appId])
                    if (implAddress !== newContract.address) {
                        const tx = await updateManager.setAppCode(encodeAppId(appId), newContract.address)
                        await tx.wait(1)
                        console.log(`New app implementation ${newContract.address} successfully added to UpdateManager`)
                    } else {
                        console.log("UpdateManager already has app last implementation")
                    }
                }
            } else {
                console.log("Not a Update Manager", um, "owner", updateManagerOwner, ". Current signer:", signerAddress)
            }
            if (updateManagerOwner !== releaseManager) {
                // todo: deprecate - it should be a 1 time action
                await updateManager.transferOwnership(releaseManager)
                console.log("Transfer ownership of UpdateManager to Realease Manager address")
            } else {
                console.log("Transfer ownership to Release Manager already set")
            }
        }
    })
