import { FunctionFragment } from "ethers/lib/utils"
import { ethers } from "ethers"
import { ERC721PropertiesInterface } from "@typechain-types/ERC721Properties"
import { ERC721WhitelistClaimInterface } from "@typechain-types/ERC721WhitelistClaim"
import { ERC721BaseSaleInterface } from "@typechain-types/ERC721BaseSale"
import { ERC721OpenSaleInterface } from "@typechain-types/ERC721OpenSale"
import { ERC721WhitelistSaleInterface } from "@typechain-types/ERC721WhitelistSale"
import { KernelInterface } from "@typechain-types/Kernel"
import { UpdateManagerInterface } from "@typechain-types/UpdateManager"
import { MockAppInterface } from "@typechain-types/MockApp"
import { AdminControllerInterface } from "@typechain-types/AdminController"
import { DOMAIN, VERSION } from "@constants/appsIds"

import ERC721PropertiesABI from "@abis/apps/ERC721Properties/ERC721Properties.sol/ERC721Properties.json"
import ERC721WhiteListClainABI from "@abis/apps/ERC721Claim/ERC721WhitelistClaim.sol/ERC721WhitelistClaim.json"
import ERC721BaseSaleABI from "@abis/apps/ERC721Sale/ERC721BaseSale.sol/ERC721BaseSale.json"
import ERC721OpenSaleABI from "@abis/apps/ERC721Sale/ERC721OpenSale.sol/ERC721OpenSale.json"
import ERC721WhitelistSaleABI from "@abis/apps/ERC721Sale/ERC721WhitelistSale.sol/ERC721WhitelistSale.json"
import KernelABI from "@abis/kernel/Kernel.sol/Kernel.json"
import UpdateManagerABI from "@abis/updateManager/UpdateManager.sol/UpdateManager.json"
import MockAppABI from "@abis/mock/MockApp.sol/MockApp.json"
import AdminControllerABI from "@abis/apps/AdminController/AdminController.sol/AdminController.json"

// const EIP712Domain = [
//     { name: 'name', type: 'string' },
//     { name: 'version', type: 'string' },
//     { name: 'chainId', type: 'uint256' },
//     { name: 'verifyingContract', type: 'address' },
// ];

const ForwardRequest = [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "data", type: "bytes" },
]

// Defining the ForwardRequest data struct values as function of `verifyingContract` address
export const buildRequest = (
    from: string,
    to: string,
    value: any,
    nonce: number,
    data: string,
    verifyingContract: string,
    chainId: number
) => ({
    primaryType: "ForwardRequest",
    types: { ForwardRequest },
    domain: { name: DOMAIN, version: VERSION, chainId, verifyingContract },
    message: { from, to, value, nonce, data },
})

const getCallDataBuilder = (abi: any) => {
    const res: any = {}
    const iface = new ethers.utils.Interface(abi.abi)
    res.encodeFunctionData = (fnName: string | FunctionFragment, args: readonly any[] | undefined) =>
        iface.encodeFunctionData(fnName, args)

    return res
}

export const ERC721PropertiesCallData: ERC721PropertiesInterface = getCallDataBuilder(ERC721PropertiesABI)
export const ERC721WhiteListClainCallData: ERC721WhitelistClaimInterface = getCallDataBuilder(ERC721WhiteListClainABI)
export const ERC721BaseSaleCallData: ERC721BaseSaleInterface = getCallDataBuilder(ERC721BaseSaleABI)
export const ERC721OpenSaleCallData: ERC721OpenSaleInterface = getCallDataBuilder(ERC721OpenSaleABI)
export const ERC721WhitelistSaleCallData: ERC721WhitelistSaleInterface = getCallDataBuilder(ERC721WhitelistSaleABI)
export const KernelCallData: KernelInterface = getCallDataBuilder(KernelABI)
export const UpdateManagerCallData: UpdateManagerInterface = getCallDataBuilder(UpdateManagerABI)
export const MockAppCallData: MockAppInterface = getCallDataBuilder(MockAppABI)
export const AdminControllerCallData: AdminControllerInterface = getCallDataBuilder(AdminControllerABI)
