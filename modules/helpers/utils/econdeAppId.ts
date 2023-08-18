import { solidityKeccak256 } from "ethers/lib/utils"

export const encodeAppId = (appId: string) => {
    return solidityKeccak256(["string"], [appId])
}
