import { utils } from "ethers"
import { MerkleTree } from "merkletreejs"

export const hashLeaf = (types: string[], values: any[]): string => {
    return utils.solidityKeccak256(types, values)
}

export const generateHashedLeafs = (types: string[], values: any[]) => {
    return values.map((val) => hashLeaf(types, val))
}

export const generateMerkleTreeFromHashedLeafs = (hashedLeafs: string[]) => {
    return new MerkleTree(hashedLeafs, utils.keccak256, { hashLeaves: false, sortPairs: true })
}
