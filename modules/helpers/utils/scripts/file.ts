import { readFileSync, promises } from "fs"

interface ContractMeta {
    contractAddress: string
}
type ContractMetas = Array<ContractMeta>

export function readContractsAddressesFromFile(path: string): Array<string> {
    // todo: why are we using sync functions?
    const file = readFileSync(path, "utf-8")
    const contractMetas: ContractMetas = JSON.parse(file)
    return contractMetas.map((struct) => struct.contractAddress)
}

type ProtocolMeta = {
    app: string
} & ContractMeta

type ProtocolMetas = Array<ProtocolMeta>

export const readProtocolMetasFromFile = async (path: string) => {
    const file = await promises.readFile(path, { encoding: "utf-8" })
    const protocolMetas: ProtocolMetas = JSON.parse(file)
    return protocolMetas
}
