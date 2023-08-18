import { expect } from "chai"
import { ethers, getNamedAccounts } from "hardhat"
import { ERC721Properties, ERC721WhitelistClaim } from "@typechain-types//"
import { deploymentFixture } from "@utils/hardhat"
import { generateHashedLeafs, generateMerkleTreeFromHashedLeafs } from "@utils/merkleTree"
import { BigNumber, BytesLike } from "ethers"
import { ClaimLimitException } from "@utils/const"
import { Exceptions } from "@constants/exceptions"

describe("ERC721WhitelistClaim [app]", () => {
    let fixture: () => Promise<void>
    let erc721: ERC721Properties
    let erc721WhitelistClaim: ERC721WhitelistClaim
    let proof: string[]

    const TIER_CLASSIC: BytesLike = ethers.utils.formatBytes32String("CLASSIC")
    const TIER_EPIC: BytesLike = ethers.utils.formatBytes32String("EPIC")
    const TIER_LEGENDARY: BytesLike = ethers.utils.formatBytes32String("LEGENDARY")

    before(async () => {
        fixture = async () => {
            const { deployer, releaseManager, successTeam } = await getNamedAccounts()

            const fixtureFunction = deploymentFixture({
                claimType: "ERC721_WHITELIST_CLAIM",
                tiers: [TIER_CLASSIC, TIER_EPIC, TIER_LEGENDARY],
                claimLimits: [1, 20, 30],
            })

            const { erc721: ferc721, erc721WhitelistClaim: ferc721WhitelistClaim } = await fixtureFunction()

            const successTeamSigner = await ethers.getSigner(successTeam)

            erc721 = ferc721 as ERC721Properties
            erc721WhitelistClaim = ferc721WhitelistClaim.connect(successTeamSigner)

            const releaseManagerSigner = await ethers.getSigner(releaseManager)
            await erc721
                .connect(releaseManagerSigner)
                .setRandomMint(TIER_CLASSIC, BigNumber.from("1000"), BigNumber.from("2"))
            await erc721WhitelistClaim.setActive(true)

            const leafTypes = ["address", "string"]

            const whitelist = [
                [deployer, ethers.utils.parseBytes32String(TIER_CLASSIC)],
                [releaseManager, ethers.utils.parseBytes32String(TIER_CLASSIC)],
            ]
            const leaves = generateHashedLeafs(leafTypes, whitelist)
            const tree = generateMerkleTreeFromHashedLeafs(leaves)

            const root = tree.getHexRoot()
            const treeIPFS = ethers.utils.formatBytes32String("MerkleTreeIPFS")
            await erc721WhitelistClaim.setMerkleTree(root, treeIPFS)

            proof = tree.getHexProof(leaves[0])
        }
    })

    beforeEach(async () => {
        await fixture()
    })

    describe("#claim", () => {
        it("emits mint event", async () => {
            const { deployer } = await getNamedAccounts()
            await expect(erc721WhitelistClaim.claim(deployer, proof, TIER_CLASSIC)).to.emit(erc721, "Mint")
        })

        describe("when claimLimit is due", () => {
            it(`reverts with ${ClaimLimitException}`, async () => {
                const { deployer } = await getNamedAccounts()
                await erc721WhitelistClaim.claim(deployer, proof, TIER_CLASSIC)
                await expect(erc721WhitelistClaim.claim(deployer, proof, TIER_CLASSIC)).to.be.revertedWith(
                    ClaimLimitException
                )
            })
        })

        describe("when proof is wrong", () => {
            it(`reverts with ${Exceptions.VALIDATION_ERROR}`, async () => {
                const { deployer } = await getNamedAccounts()
                await expect(
                    erc721WhitelistClaim.claim(
                        deployer,
                        [ethers.utils.formatBytes32String("wrong proof")],
                        TIER_CLASSIC
                    )
                ).to.be.revertedWith(Exceptions.VALIDATION_ERROR)
            })
        })
    })

    describe("#setActive", () => {
        describe("when the contract is not active", () => {
            it(`reverts with ${ClaimLimitException}`, async () => {
                const { deployer } = await getNamedAccounts()
                await erc721WhitelistClaim.setActive(false)
                await expect(erc721WhitelistClaim.claim(deployer, proof, TIER_CLASSIC)).to.be.reverted
            })
        })
    })
})
