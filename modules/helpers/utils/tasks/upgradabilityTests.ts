import { AppsIds } from "@constants/appsIds"
import { factoryMapping } from "@constants/mappings"
import {
    fetchKernelAddressesAndFilter,
    readKernelAddressesFromFileAndFilter,
} from "@scripts/core/read-from-file-filtered"
import { Environment } from "@scripts/interfaces/environment"
import { filterApps } from "@utils/filterApps"
import { Deployment } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"

export async function getAppAddresses(
    hre: HardhatRuntimeEnvironment,
    appIds: Array<keyof typeof AppsIds>
): Promise<Array<string>> {
    const appAddresses: Array<string> = []
    for (const i in appIds) {
        const appId = appIds[i]
        const contract: Deployment = await hre.deployments.get(factoryMapping[appId])
        appAddresses.push(contract.address)
    }
    return appAddresses
}

export function filterNotSimilarAppIdAddresses(
    appIds: Array<any>,
    before: Array<string>,
    after: Array<string>
): Array<string> {
    const filtered: Array<string> = []
    for (const i in before) {
        if (before[i] !== after[i]) {
            filtered.push(appIds[i])
        }
    }
    return filtered
}

export const getAppsToTest = async (
    hre: HardhatRuntimeEnvironment,
    noDeploy: boolean,
    appsToTrackInput: any,
    forceApps: boolean
) => {
    const appsToTrack: Array<keyof typeof AppsIds> = filterApps(appsToTrackInput || [])

    console.log(`Get addresses for ${appsToTrack} before the hardhat-deploy task...`)
    const appAddressesBefore: Array<string> = await getAppAddresses(hre, appsToTrack)

    if (!noDeploy) {
        console.log(`Run deploy task with writing deployments to folder...`)
        await hre.run("deploy", { write: true, tags: "implementations" })
    }

    console.log(`Get addresses for ${appsToTrack} after the hardhat-deploy task...`)
    const appAddressesAfter: Array<string> = await getAppAddresses(hre, appsToTrack)

    const appsToTest = forceApps
        ? appsToTrack
        : filterNotSimilarAppIdAddresses(appsToTrack, appAddressesBefore, appAddressesAfter)

    return appsToTest
}

export const conditionalKernels = async (condition: boolean, env: Environment, filePath?: string) =>
    condition
        ? await fetchKernelAddressesAndFilter(env, 1000)
        : readKernelAddressesFromFileAndFilter(env, filePath || "")
