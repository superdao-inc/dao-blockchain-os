import { ProtocolApp } from "@scripts/core/upgrade-protocol-contracts"
import { AppsIds, ProtocolApps } from "@constants/appsIds"

// todo: AppsIds.ERC721_WHITELIST_CLAIM, AppsIds.ERC721_LINK_CLAIM break on add-to-updatemanager task
const badApps = [
    AppsIds.SUDO,
    AppsIds.RELEASE_MANAGER,
    AppsIds.UPDATE_MANAGER,
    AppsIds.ERC721_WHITELIST_CLAIM,
    AppsIds.ERC721_LINK_CLAIM,
]

export const filterApps = (apps: any) =>
    (!!apps?.split && apps.split(",").length > 0
        ? (apps.split(",") as Array<keyof typeof AppsIds>)
        : (Object.keys(AppsIds) as Array<keyof typeof AppsIds>)
    ).filter((app) => !badApps.includes(app))

export const filterProtocolContracts = (apps: Array<{ contractAddress: string; app: string }>): ProtocolApp[] =>
    apps.filter((app) => Object.keys(ProtocolApps).includes(app?.app)) as ProtocolApp[]

export const validApp = (app: string) => !!Object.keys(AppsIds).includes(app)
