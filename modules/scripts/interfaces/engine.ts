// From dev start OS typescript code is fully riles on hardhat runtime environment (hre)
// with its custom ethers but sometimes (e.g. tenderly fork simulation) we want our
// scripts to run through non hardhat ethers specific provider and(or) even through
// provider with additional features (e.g. send unsigned trx as its in Tenderly)
// To match this behaviour fork Engine class presented here.
import { SimulatorABC } from "@utils/simulatorABC"
import { HardhatEthersHelpers } from "hardhat-deploy-ethers/types"
import { ethers } from "ethers"

export interface HardhatEthersEngine {
    hreEthers: typeof ethers & HardhatEthersHelpers
    simulator?: SimulatorABC
    deployments?: any
}

export interface SimulatorEngine {
    hreEthers?: typeof ethers & HardhatEthersHelpers
    simulator: SimulatorABC
    deployments?: any
}

export type Engine = HardhatEthersEngine | SimulatorEngine
