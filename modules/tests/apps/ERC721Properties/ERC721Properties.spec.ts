import { expect } from "chai"
import { ethers, getNamedAccounts } from "hardhat"
import { Kernel, MockApp, ERC721Properties, MockVRFCoordinator } from "@typechain-types//"
import { deploymentFixture } from "@utils/hardhat"
import { Interface } from "ethers/lib/utils"
import { BASE_NAME, BASE_SYMBOL, erc721Constants, InterfaceIds } from "@utils/const"
import { BigNumber, BytesLike } from "ethers"
import { Exceptions } from "@constants/exceptions"

describe("ERC721Properties [app]", () => {
    let fixture: () => Promise<void>
    let erc721: ERC721Properties
    let kernel: Kernel
    let app: MockApp
    let mockCoordinator: MockVRFCoordinator
    const PROPERTY_TIER = "TIER"
    const TIER_CLASSIC: BytesLike = ethers.utils.formatBytes32String("CLASSIC")
    const TIER_EPIC: BytesLike = ethers.utils.formatBytes32String("EPIC")
    const TIER_LEGENDARY: BytesLike = ethers.utils.formatBytes32String("LEGENDARY")
    const TIER_SHUFFLE: BytesLike = ethers.utils.formatBytes32String("SHUFFLE")

    const classicCount = 1000
    const epicCount = 100
    const legendaryCount = 10
    const artworkAmount = 2

    before(async () => {
        fixture = async () => {
            const fixtureFunction = deploymentFixture({})

            const {
                kernel: fkernel,
                erc721: ferc721,
                app: fapp,
                mockVRFCoordinator: fmockVRFCoordinator,
            } = await fixtureFunction()

            const { releaseManager } = await getNamedAccounts()
            const releaseManagerSigner = await ethers.getSigner(releaseManager)

            kernel = fkernel
            erc721 = ferc721.connect(releaseManagerSigner)
            app = fapp
            mockCoordinator = fmockVRFCoordinator

            await erc721.setRandomMint(
                TIER_CLASSIC,
                BigNumber.from(classicCount.toString()),
                BigNumber.from(artworkAmount.toString())
            )
            await erc721.setRandomMint(
                TIER_EPIC,
                BigNumber.from(epicCount.toString()),
                BigNumber.from(artworkAmount.toString())
            )
            await erc721.setRandomMint(
                TIER_LEGENDARY,
                BigNumber.from(legendaryCount.toString()),
                BigNumber.from(artworkAmount.toString())
            )
        }
    })

    beforeEach(async () => {
        await fixture()
    })

    describe("#mint", () => {
        it("emits Mint event", async () => {
            const { deployer } = await getNamedAccounts()
            await expect(erc721.mint(deployer, TIER_CLASSIC)).to.emit(erc721, "Mint")
        })

        it("mints new token and assigns properties", async () => {
            const receiver = ethers.Wallet.createRandom()
            const tierValue = TIER_EPIC
            await erc721.mint(receiver.address, tierValue)
            expect(await erc721.ownerOf(0)).to.eq(receiver.address)
            expect(await erc721.balanceOf(receiver.address)).to.eq(1)
            expect(await erc721.getPropertyValue(0, PROPERTY_TIER)).to.eq(tierValue)
        })

        it("mints new token using chainlink VRF", async () => {
            const receiver = ethers.Wallet.createRandom()
            const tierValue = TIER_EPIC
            await erc721.setupVRF(mockCoordinator.address, 0)
            await erc721.mint(receiver.address, tierValue)
            const requestId = await mockCoordinator.id()
            const tx = await mockCoordinator.rawFulfillRandomWords(requestId, [424242])
            await tx.wait()
        })

        describe("we can burn when restrictBurnPolicy = false", () => {
            it("mint and immediately burn", async () => {
                const { deployer } = await getNamedAccounts()
                const tierValue = TIER_EPIC
                await erc721.mint(deployer, tierValue)
                expect(await erc721.ownerOf(0)).to.eq(deployer)
                await expect(erc721.burn(0)).to.emit(erc721, "Burn")
            })
        })

        describe("when restrictBurnPolicy = true, we can't burn and transaction reverted", () => {
            it("reverts", async () => {
                const { deployer } = await getNamedAccounts()
                const tierValue = TIER_EPIC
                await erc721.mint(deployer, tierValue)
                expect(await erc721.ownerOf(0)).to.eq(deployer)
                await erc721.setRestrictBurnPolicy(true)
                expect(await erc721.getRestrictBurnPolicy()).to.eq(true)
                await expect(erc721.burn(0)).to.be.reverted
            })
        })

        describe("attempt to mint a token with invalid tier value", () => {
            it("reverts", async () => {
                const { deployer } = await getNamedAccounts()
                const value = ethers.utils.formatBytes32String("TIER_INVALID")
                await expect(erc721.mint(deployer, value)).to.be.reverted
            })
        })

        describe("when msg.sender is random wallet", () => {
            it("reverts", async () => {
                const stranger = ethers.Wallet.createRandom()
                await expect(erc721.connect(stranger).mint(stranger.address, TIER_CLASSIC)).to.be.reverted
            })
        })

        describe("when msg.sender is random wallet", () => {
            it("reverts", async () => {
                const stranger = ethers.Wallet.createRandom()
                await expect(erc721.connect(stranger).mint(stranger.address, TIER_CLASSIC)).to.be.reverted
            })
        })
    })

    describe("#setRandomShuffleMint", () => {
        it("mints new tokens", async () => {
            const { deployer } = await getNamedAccounts()
            await erc721.setRandomShuffleMint(TIER_SHUFFLE, BigNumber.from("10"))
            await expect(erc721.mint(deployer, TIER_SHUFFLE)).to.emit(erc721, "Mint")
        })
    })

    describe("#getAttribute", () => {
        it("gets attribute", async () => {
            const attrAmt = await erc721.getAttribute(
                erc721Constants.PROPERTY_TIER,
                TIER_CLASSIC,
                erc721Constants.ATTRIBUTE_MAX_AMOUNT
            )
            expect(attrAmt).to.eq(ethers.utils.hexZeroPad(ethers.utils.hexValue(classicCount), 32))
        })
    })

    describe("#tokenURI", () => {
        it("gets token URI", async () => {
            const attrAmt = await erc721.tokenURI(0)
            expect(attrAmt).to.eq("baseURI")
        })
    })

    describe("#setAttribute", () => {
        it("sets attribute", async () => {
            const attrValue = ethers.utils.hexZeroPad(ethers.utils.hexValue(0), 32)

            await erc721.setAttribute(
                erc721Constants.PROPERTY_TIER,
                TIER_CLASSIC,
                erc721Constants.ATTRIBUTE_MAX_AMOUNT,
                attrValue
            )
            expect(
                await erc721.getAttribute(
                    erc721Constants.PROPERTY_TIER,
                    TIER_CLASSIC,
                    erc721Constants.ATTRIBUTE_MAX_AMOUNT
                )
            ).to.eq(attrValue)
            const { deployer } = await getNamedAccounts()
            await expect(erc721.mint(deployer, TIER_CLASSIC)).to.be.revertedWith(Exceptions.INVALID_TIER_AMOUNT_ERROR)
        })
    })

    describe("#setName", () => {
        it("changes collection name", async () => {
            expect(await kernel.hasPermission(app.address, erc721.address, 0)).to.be.true
            expect(await erc721.name()).to.eq(BASE_NAME)
            const newName = "NameTest"
            await erc721.setName(newName)
            expect(await erc721.name()).to.eq(newName)
        })
    })

    describe("#setSymbol", () => {
        it("changes collection symbol", async () => {
            expect(await kernel.hasPermission(app.address, erc721.address, 0)).to.be.true
            expect(await erc721.name()).to.eq("Name")
            const iface = new Interface(["function setName(string)"])
            await app.appCall(erc721.address, iface.encodeFunctionData("setName", ["NameTest"]))
            expect(await erc721.name()).to.eq("NameTest")
            expect(await erc721.symbol()).to.eq(BASE_SYMBOL)
            const newSymbol = "SymbolTest"
            await erc721.setSymbol(newSymbol)
            expect(await erc721.symbol()).to.eq(newSymbol)
        })
    })

    describe("#supportsInterface", () => {
        it("supports interface ERC-165", async () => {
            expect(await erc721.supportsInterface(InterfaceIds.IERC165)).to.be.true
        })
        it("not supports interface ERC-1155", async () => {
            expect(await erc721.supportsInterface(InterfaceIds.IERC1155)).to.be.false
        })
        it("not supports interface ERC-721", async () => {
            expect(await erc721.supportsInterface(InterfaceIds.IERC721)).to.be.true
        })
    })
})
