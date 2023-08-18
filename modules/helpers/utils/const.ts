import { keccak256 } from "ethers/lib/utils"
import { ethers } from "ethers"
// TODO:
// @ts-ignore
import { makeInterfaceId } from "@openzeppelin/test-helpers"

export const MockAppContract = "MockApp"
export const KernelContract = "Kernel"
export const InitEvent = "Init"
export const UpgradeEvent = "Upgrade"
export const AuthorizationException = "AUTHORIZATION"
export const AlreadyInitializedException = "Initializable: contract is already initialized"
export const ClaimLimitException = "CLAIM_LIMIT_ERROR"

const encodeAppId = (appId: string) => keccak256(ethers.utils.toUtf8Bytes(appId))

export const BASE_NAME = "Name"
export const BASE_SYMBOL = "Symbol"
export const BASE_URI = "baseURI"

export const AppsIds = {
    KERNEL: encodeAppId("KERNEL"),
    SUDO: encodeAppId("SUDO"),
    ERC721: encodeAppId("ERC721"),
    ADMIN_CONTROLLER: encodeAppId("ADMIN"),
    ERC721_OPEN_SALE: encodeAppId("ERC721_OPEN_SALE"),
    ERC721_WHITELIST_SALE: encodeAppId("ERC721_WHITELIST_SALE"),
    TREASURY: encodeAppId("WALLET"),
    MOCKAPP: encodeAppId("MockApp"),
    ERC721_WHITELIST_CLAIM: encodeAppId("ERC721_WHITELIST_CLAIM"),
    ERC721_LINK_CLAIM: encodeAppId("ERC721_LINK_CLAIM"),
    RELEASE_MANAGER: encodeAppId("RELEASE_MANAGER"),
}

const Interface: { [key: string]: any } = {
    IERC165: ["supportsInterface(bytes4)"],
    IERC721: [
        "balanceOf(address)",
        "ownerOf(uint256)",
        "approve(address,uint256)",
        "getApproved(uint256)",
        "setApprovalForAll(address,bool)",
        "isApprovedForAll(address,address)",
        "transferFrom(address,address,uint256)",
        "safeTransferFrom(address,address,uint256)",
        "safeTransferFrom(address,address,uint256,bytes)",
    ],
    IERC721Metadata: ["name()", "symbol()", "tokenURI(uint256)"],
    IERC1155: [
        "balanceOf(address,uint256)",
        "balanceOfBatch(address[],uint256[])",
        "setApprovalForAll(address,bool)",
        "isApprovedForAll(address,address)",
        "safeTransferFrom(address,address,uint256,uint256,bytes)",
        "safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)",
    ],
    IKernel: [
        "getUpdateManager()",
        "deployApp(bytes32,bytes)",
        "upgradeApp(bytes32)",
        "setTreasury(address)",
        "getTreasury()",
        "deploySafe(address[],uint256)",
    ],
    IAppManager: ["connectApp(bytes32,address,bool)", "resetApp(bytes32,address,bool)", "getAppAddress(bytes32)"],
    IACL: [
        "addPermission(bytes32,bytes32,uint8)",
        "removePermission(bytes32,bytes32,uint8)",
        "getPermissions(bytes32,bytes32)",
        "hasPermission(address,address,uint8)",
    ],
}

export const InterfaceIds: { [key: string]: any } = {}

for (const k of Object.getOwnPropertyNames(Interface)) {
    InterfaceIds[k] = makeInterfaceId.ERC165(Interface[k])
}

export const erc721Constants = {
    PROPERTY_TIER: "TIER",
    PROPERTY_ARTWORK_ID: "ARTWORK_ID",

    ATTRIBUTE_TIER_EXTRA_ARTWORKS_NUM: "TIER_EXTRA_ARTWORKS_NUM",
    ATTRIBUTE_TIER_RANDOM_MINT: "TIER_RANDOM_MINT",
    ATTRIBUTE_TIER_RANDOM_SHUFFLE_MINT: "TIER_RANDOM_SHUFFLE_MINT",

    ATTRIBUTE_MAX_AMOUNT: "MAX_AMOUNT",
    ATTRIBUTE_TOTAL_AMOUNT: "TOTAL_AMOUNT",
    ATTRIBUTE_IS_TRANSFERABLE: "IS_TRANSFERABLE",
    ATTRIBUTE_UNLOCKS_AT_HOURS: "TRANSFER_UNLOCKS_AT_HOURS",
    BURN_POLICY_ERROR: "BURN_POLICY_ERROR",
}
