import { expect } from "chai"
import { ethers, getNamedAccounts } from "hardhat"
import { ERC721Properties, ERC721WhitelistSale } from "@typechain-types//"
import { deploymentFixture } from "@utils/hardhat"
import { BytesLike, BigNumber } from "ethers"
import { generateHashedLeafs, generateMerkleTreeFromHashedLeafs } from "@utils//"
import { SaleAppIds } from "@constants//"

describe("ERC721WhitelistSale [app]", () => {
    let fixture: () => Promise<void>
    let erc721OverProxy: ERC721Properties
    let erc721WhitelistSale: ERC721WhitelistSale
    let proof: string[]

    const TIER_CLASSIC: BytesLike = ethers.utils.formatBytes32String("CLASSIC")
    const TIER_CLASSIC_PRICE = ethers.utils.parseEther("10")

    before(async () => {
        fixture = async () => {
            const { deployer, releaseManager, successTeam } = await getNamedAccounts()
            const fixtureFunction = deploymentFixture({
                saleType: SaleAppIds.ERC721_WHITELIST_SALE as keyof typeof SaleAppIds,
            })

            const { erc721: ferc721OverProxy, erc721WhitelistSale: ferc721WhitelistSale } = await fixtureFunction()

            const releaseManagerSigner = await ethers.getSigner(releaseManager)

            erc721OverProxy = ferc721OverProxy.connect(releaseManagerSigner)
            erc721WhitelistSale = ferc721WhitelistSale.connect(releaseManagerSigner)

            await erc721OverProxy.setRandomMint(TIER_CLASSIC, BigNumber.from("1000"), BigNumber.from("2"))

            await erc721WhitelistSale.setActive(true)

            await erc721WhitelistSale.setPaymentPolicy([TIER_CLASSIC], [TIER_CLASSIC_PRICE])
            await erc721WhitelistSale.setClaimLimit(0)

            const leafTypes = ["address", "bytes32"]

            const whitelist = [
                [deployer, TIER_CLASSIC],
                [releaseManager, TIER_CLASSIC],
            ]
            const leaves = generateHashedLeafs(leafTypes, whitelist)
            const tree = generateMerkleTreeFromHashedLeafs(leaves)

            const root = tree.getHexRoot()
            const treeIPFS = ethers.utils.formatBytes32String("MerkleTreeIPFS")
            await erc721WhitelistSale.setMerkleTree(root, treeIPFS)
            proof = tree.getHexProof(leaves[0])
        }
    })

    beforeEach(async () => {
        await fixture()
    })

    describe("#buy", () => {
        it("emits buy event", async () => {
            const { deployer } = await getNamedAccounts()
            const deployerSigner = await ethers.getSigner(deployer)
            await expect(
                erc721WhitelistSale.connect(deployerSigner).buy(proof, TIER_CLASSIC, {
                    value: TIER_CLASSIC_PRICE,
                })
            )
                .to.emit(erc721WhitelistSale, "OnBuy")
                .withArgs(
                    deployer,
                    erc721OverProxy.address,
                    TIER_CLASSIC,
                    TIER_CLASSIC_PRICE,
                    ethers.constants.AddressZero,
                    "Whitelist",
                    []
                )
        })
    })

    describe("#buy with individual wallet limits and price", () => {
        const walletLimit = 10
        const walletPrice = ethers.utils.parseEther("10")

        it("emits buy event", async () => {
            const { deployer, releaseManager } = await getNamedAccounts()
            const deployerSigner = await ethers.getSigner(deployer)
            const leafTypes = ["address", "bytes32", "uint256", "uint256"]

            const whitelist = [
                [deployer, TIER_CLASSIC, walletLimit, walletPrice],
                [releaseManager, TIER_CLASSIC, walletLimit, walletPrice],
            ]

            const leaves = generateHashedLeafs(leafTypes, whitelist)
            const tree = generateMerkleTreeFromHashedLeafs(leaves)

            const root = tree.getHexRoot()
            const treeIPFS = ethers.utils.formatBytes32String("MerkleTreeIPFS")
            await erc721WhitelistSale.setMerkleTree(root, treeIPFS)

            proof = tree.getHexProof(leaves[0])

            await expect(
                erc721WhitelistSale
                    .connect(deployerSigner)
                    .buyWithLimits(proof, TIER_CLASSIC, walletLimit, walletPrice, {
                        value: walletPrice,
                    })
            )
                .to.emit(erc721WhitelistSale, "OnBuy")
                .withArgs(
                    deployer,
                    erc721OverProxy.address,
                    TIER_CLASSIC,
                    walletPrice,
                    ethers.constants.AddressZero,
                    "Whitelist",
                    []
                )
        })
    })
})
