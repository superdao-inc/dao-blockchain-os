import { readContractsAddressesFromFile } from "@utils/scripts/file"
import { getKernelsSuperdaoDB } from "@scripts/http/getKernels"
import { filterKernels } from "@utils/scripts/filterKernels"
import { Environment } from "@scripts/interfaces/environment"

function _readContractAddressesFromFileAndFilter(env: Environment, pathToContracts: string): Array<string> {
    const kernelsAll = readContractsAddressesFromFile(pathToContracts).map((el) => ({ contractAddress: el }))
    return filterKernels(env, kernelsAll).map((el) => el.contractAddress)
}

export const fetchKernelAddressesAndFilter = async (env: Environment, batchSize: number) => {
    const unfilteredKernels = await getKernelsSuperdaoDB(env, batchSize)
    return filterKernels(env, unfilteredKernels).map((el) => el.contractAddress)
}

export function readKernelAddressesFromFileAndFilter(env: Environment, path: string) {
    return _readContractAddressesFromFileAndFilter(env, path)
}

export function readFilterUpdateManagers(env: Environment, path: string) {
    return _readContractAddressesFromFileAndFilter(env, path)
}
