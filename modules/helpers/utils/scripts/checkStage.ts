import { HardhatRuntimeEnvironment } from "hardhat/types"

export const checkStage = (hre: HardhatRuntimeEnvironment) =>
    hre.network.name === "stage" || process?.env?.FORKING_MODE === "STAGE"
