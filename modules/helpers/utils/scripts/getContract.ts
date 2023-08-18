import { Engine } from "@scripts/interfaces/engine"
import { Contract, ethers } from "ethers"
import { Artifact } from "hardhat/types"
import { Artifacts } from "hardhat/internal/artifacts"

const artifacts = new Artifacts("./artifacts")

export async function getContract(engine: Engine, address: string, contractTitle: string): Promise<Contract> {
    // This function make it possible to get contract as simple ethers like hardhat does
    // (in simulator custom class simple ethers used).
    const contractArtifacts: Artifact = await artifacts.readArtifact(contractTitle)
    if (engine.hreEthers) {
        return await engine.hreEthers.getContractAt(contractArtifacts.abi, address)
    }
    const signer = engine.simulator!.provider.getSigner()
    console.log("Init contract for a simulator with default signer from provider", await signer.getAddress())
    return new ethers.Contract(address, contractArtifacts.abi, signer)
}
