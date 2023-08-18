import { expect } from "chai"
import { ethers, getNamedAccounts } from "hardhat"
import { ERC721Properties, ERC721LinkClaim } from "@typechain-types//"
import { deploymentFixture } from "@utils/hardhat"
import { generateHashedLeafs, generateMerkleTreeFromHashedLeafs } from "@utils/merkleTree"
import { BigNumber, BytesLike } from "ethers"
import { ClaimLimitException } from "@utils/const"
import { Exceptions } from "@constants/exceptions"

describe("ERC721LinkClaim [app]", () => {
    let fixture: () => Promise<void>
    let erc721OverProxy: ERC721Properties
    let erc721LinkClaim: ERC721LinkClaim
    let proof: string[]
    let linkOne: string
    let linkTwo: string

    const TIER_CLASSIC: BytesLike = ethers.utils.formatBytes32String("CLASSIC")
    const TIER_EPIC: BytesLike = ethers.utils.formatBytes32String("EPIC")
    const TIER_LEGENDARY: BytesLike = ethers.utils.formatBytes32String("LEGENDARY")

    before(async () => {
        fixture = async () => {
            const fixtureFunction = deploymentFixture({
                claimType: "ERC721_LINK_CLAIM",
                tiers: [TIER_CLASSIC, TIER_EPIC, TIER_LEGENDARY],
                claimLimits: [1, 20, 30],
            })

            const { erc721: ferc721, erc721LinkClaim: ferc721LinkClaim, app: fapp } = await fixtureFunction()

            erc721OverProxy = ferc721 as ERC721Properties
            erc721LinkClaim = ferc721LinkClaim as ERC721LinkClaim

            const { successTeam, releaseManager } = await getNamedAccounts()
            const releaseManagerSigner = await ethers.getSigner(releaseManager)
            await erc721OverProxy
                .connect(releaseManagerSigner)
                .setRandomMint(TIER_CLASSIC, BigNumber.from("1000"), BigNumber.from("2"))

            const successTeamSigner = await ethers.getSigner(successTeam)
            await erc721LinkClaim.connect(successTeamSigner).setActive(true)

            const leafTypes = ["bytes32", "string"]
            linkOne = ethers.utils.solidityKeccak256(["string"], ["foo@gmail.com" + "superSalt"])
            linkTwo = ethers.utils.solidityKeccak256(["string"], ["bar@gmail.com" + "superSalt"])

            const linklist = [
                [linkOne, ethers.utils.parseBytes32String(TIER_CLASSIC)],
                [linkTwo, ethers.utils.parseBytes32String(TIER_CLASSIC)],
            ]
            const leaves = generateHashedLeafs(leafTypes, linklist)
            const tree = generateMerkleTreeFromHashedLeafs(leaves)

            const root = tree.getHexRoot()
            const treeIPFS = ethers.utils.formatBytes32String("MerkleTreeIPFS")
            await erc721LinkClaim.connect(successTeamSigner).setMerkleTree(root, treeIPFS)

            proof = tree.getHexProof(leaves[0])
        }
    })

    beforeEach(async () => {
        await fixture()
    })

    describe("#claim", () => {
        it("emits mint event", async () => {
            const { deployer, successTeam } = await getNamedAccounts()
            expect(await erc721LinkClaim.linkAlreadyUsed(linkOne)).to.be.equal(false)
            const successTeamSigner = await ethers.getSigner(successTeam)
            await expect(
                erc721LinkClaim.connect(successTeamSigner).claim(deployer, linkOne, proof, TIER_CLASSIC)
            ).to.emit(erc721OverProxy, "Mint")
            expect(await erc721LinkClaim.linkAlreadyUsed(linkOne)).to.be.equal(true)
        })

        describe("when claimLimit is due", () => {
            it(`reverts with ${Exceptions.VALIDATION_ERROR}`, async () => {
                const { deployer, successTeam } = await getNamedAccounts()
                const successTeamSigner = await ethers.getSigner(successTeam)
                await erc721LinkClaim.connect(successTeamSigner).claim(deployer, linkOne, proof, TIER_CLASSIC)
                await expect(
                    erc721LinkClaim.connect(successTeamSigner).claim(deployer, linkOne, proof, TIER_CLASSIC)
                ).to.be.revertedWith(Exceptions.VALIDATION_ERROR)
            })
        })

        describe("when proof is wrong", () => {
            it(`reverts with ${Exceptions.VALIDATION_ERROR}`, async () => {
                const { deployer, successTeam } = await getNamedAccounts()
                const successTeamSigner = await ethers.getSigner(successTeam)
                await expect(
                    erc721LinkClaim
                        .connect(successTeamSigner)
                        .claim(deployer, linkOne, [ethers.utils.formatBytes32String("wrong proof")], TIER_CLASSIC)
                ).to.be.revertedWith(Exceptions.VALIDATION_ERROR)
            })
        })
    })

    describe("#setActive", () => {
        describe("when the contract is not active", () => {
            it(`reverts with ${ClaimLimitException}`, async () => {
                const { deployer, successTeam } = await getNamedAccounts()
                const successTeamSigner = await ethers.getSigner(successTeam)
                await erc721LinkClaim.connect(successTeamSigner).setActive(false)
                await expect(erc721LinkClaim.connect(successTeamSigner).claim(deployer, linkTwo, proof, TIER_CLASSIC))
                    .to.be.reverted
            })
        })
    })
})
