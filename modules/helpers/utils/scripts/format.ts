import { keccak256 } from "ethers/lib/utils"
import { BigNumber, ethers } from "ethers"

export const encodeAppId = (appId: string) => keccak256(ethers.utils.toUtf8Bytes(appId))
export const formatWeiToRpcFormat = (value: string) => BigNumber.from(value).toHexString().replace("0x0", "0x")
