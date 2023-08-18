import { AppsIds } from "@constants/appsIds"
import { encodeAppId } from "@utils/scripts/format"
import { ethers } from "ethers"

export async function createReleaseApp(kernel: any, releaseManager: string, raiseOnError = false) {
    let isKernelAdmin = false
    try {
        isKernelAdmin = await kernel.hasPermission(releaseManager, kernel.address, 0)
    } catch (e) {}
    if (isKernelAdmin) {
        console.log("Creating release manager app")
        try {
            const addressRM = await kernel.getAppAddress(encodeAppId(AppsIds.RELEASE_MANAGER))
            if (addressRM === ethers.constants.AddressZero) {
                const tx = await kernel.connectApp(encodeAppId(AppsIds.RELEASE_MANAGER), releaseManager, false)
                await tx.wait(1)
                console.log("Release manager app created")
            } else {
                console.log("Release manager app have already been created")
            }
            await addPermissions(kernel, releaseManager)
        } catch (e) {
            if (raiseOnError) {
                throw e
            }
            const message = (e as Error).message
            console.log(message)
        }
    } else {
        console.log("Not a valid kernel contract or no access")
    }
}

async function addPermissions(kernel: any, releaseManager: string) {
    await addPermissionToApp(kernel, releaseManager, AppsIds.KERNEL)
    await addPermissionToApp(kernel, releaseManager, AppsIds.ERC721)
    await addPermissionToApp(kernel, releaseManager, AppsIds.ERC721_OPEN_SALE)
    await addPermissionToApp(kernel, releaseManager, AppsIds.ERC721_WHITELIST_SALE)
}
async function addPermissionToApp(kernel: any, releaseManager: string, appId: string) {
    const isExist = (await kernel.getAppAddress(encodeAppId(appId))) !== ethers.constants.AddressZero
    let isPerm = false
    try {
        isPerm = await kernel.hasPermission(releaseManager, await kernel.getAppAddress(encodeAppId(appId)), 0)
    } catch (e) {}
    if (!isPerm && isExist) {
        console.log("Adding permissions to", appId)
        const tx = await kernel.addPermission(encodeAppId(AppsIds.RELEASE_MANAGER), encodeAppId(appId), 0)
        await tx.wait(1)
    } else if (isPerm) {
        console.log("Permissioms to", appId, "already set")
    } else {
        console.log("App", appId, "does not exist")
    }
}
