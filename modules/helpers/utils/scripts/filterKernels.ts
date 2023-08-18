import { Environment } from "@scripts/interfaces/environment"
import noUpdateManagerMainnet from "../../../../data/mainnet.kernelsNoUpdateManager.json"
import withInvariantMainnet from "../../../../data/mainnet.kernelsWithInvariantUnderReleaseManagerAccount.json"
import withUnknownMainnet from "../../../../data/mainnet.kernelsWithUnknownUpgradeError.json"
import withUnknownStage from "../../../../data/stage.kernelsWithUnknownUpgradeError.json"

export type ContractJSON = { contractAddress: string }

export const filterKernels = (env: Environment, kernels: ContractJSON[]) => {
    const badKernelsMainnet = [
        ...noUpdateManagerMainnet.map((el: ContractJSON) => el.contractAddress),
        ...withInvariantMainnet.map((el: ContractJSON) => el.contractAddress),
        ...withUnknownMainnet.map((el: ContractJSON) => el.contractAddress),
    ]
    const badKernelsStage: string[] = [...withUnknownStage.map((el: ContractJSON) => el.contractAddress)]

    const badKernels = env === Environment.MAINNET ? badKernelsMainnet : badKernelsStage
    badKernels.push("")

    const kerns = kernels.filter((kernel: ContractJSON) => !badKernels.includes(kernel.contractAddress))
    return kerns
}
