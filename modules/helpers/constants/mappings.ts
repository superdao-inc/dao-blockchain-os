// todo: rename coz now it is 2 general
import { AppsIds, ProtocolApps } from "./appsIds"

export const factoryMapping: typeof AppsIds = {
    KERNEL: "Kernel",
    SUDO: "Sudo",
    ERC721: "ERC721Properties",
    ADMIN: "AdminController", // TODO: rename admin to ADMIN_CONTROLLER [!deprecated!]
    ERC721_OPEN_SALE: "ERC721OpenSale",
    ERC721_WHITELIST_SALE: "ERC721WhitelistSale",
    RELEASE_MANAGER: "ReleaseManager",
    UPDATE_MANAGER: "UpdateManager",
    ERC721_WHITELIST_CLAIM: "ERC721WhitelistClaim",
    ERC721_LINK_CLAIM: "ERC721LinkClaim",
}

export const protocolFactoryMapping: typeof ProtocolApps = {
    DAO_CONSTRUCTOR: "DAOConstructor",
    UPDATE_MANAGER: "UpdateManager",
    UNISWAP_V3_ORACLE: "UniswapV3Oracle",
    CALL_FORWARDER: "CallForwarder",
}
