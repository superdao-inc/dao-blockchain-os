import { expect } from "chai"
import { ethers, getNamedAccounts } from "hardhat"
import { ERC721Properties, ERC721OpenSale, UniswapV3Oracle, MockERC20, IUniswapV3Factory } from "@typechain-types//"
import { deploymentFixture } from "@utils/hardhat"

describe("ERC721OpenSale [app]", () => {
    let fixture: () => Promise<void>
    let erc721OverProxy: ERC721Properties
    let erc721OpenSale: ERC721OpenSale
    let uniswapV3Oracle: UniswapV3Oracle
    let uniswapV3Factory: IUniswapV3Factory

    let token0: MockERC20
    let token1: MockERC20

    const sampleTier = ethers.utils.formatBytes32String("SAMPLE")

    const TIER_SAMPLE = ethers.utils.formatBytes32String("SAMPLE")
    const TIER_SAMPLE_PRICE = ethers.utils.parseEther("10")

    before(async () => {
        fixture = async () => {
            const { usdcAddress } = await getNamedAccounts()
            const fixtureFunction = deploymentFixture({ saleType: "ERC721_OPEN_SALE" })
            const {
                erc721: ferc721OverProxy,
                erc721OpenSale: ferc721OpenSale,
                uniswapV3Factory: funiswapV3Factory,
                uniswapV3Oracle: funiswapV3Oracle,
            } = await fixtureFunction()

            const { releaseManager } = await getNamedAccounts()
            const releaseManagerSigner = await ethers.getSigner(releaseManager)

            erc721OverProxy = ferc721OverProxy.connect(releaseManagerSigner)
            erc721OpenSale = ferc721OpenSale.connect(releaseManagerSigner)
            uniswapV3Oracle = funiswapV3Oracle.connect(releaseManagerSigner)
            uniswapV3Factory = funiswapV3Factory

            const tokenFactory = await ethers.getContractFactory("MockERC20")
            token0 = (await tokenFactory.deploy("Token1", "TOK1")) as MockERC20
            token1 = (await tokenFactory.deploy("Token2", "TOK2")) as MockERC20

            await uniswapV3Factory.enableFeeAmount(1000, 30)
            await uniswapV3Factory.createPool(token0.address, token1.address, 1000, {
                gasLimit: 10000000,
            })

            await erc721OpenSale.setActive(true)
            await erc721OpenSale.setPaymentPolicy([TIER_SAMPLE], [TIER_SAMPLE_PRICE])

            await uniswapV3Oracle.setWhitelistTokenAddress([usdcAddress, token1.address])
            await erc721OpenSale.setTokenSaleAddress(token1.address)
            await erc721OpenSale.setClaimLimit(0)
            await erc721OpenSale.setTierPerWalletLimits([TIER_SAMPLE], [10])
            await erc721OpenSale.setTotalClaimsLimits(10)
            await erc721OverProxy.setRandomMint(TIER_SAMPLE, 10, 10)
        }
    })

    beforeEach(async () => {
        await fixture()
    })

    describe("#buy", () => {
        it("emits buy event", async () => {
            const { deployer } = await getNamedAccounts()
            const [_, costInBuyTokens] = await erc721OpenSale.getPrice(token1.address, sampleTier)

            await token1.approve(erc721OpenSale.address, costInBuyTokens)

            await expect(erc721OpenSale.buy(deployer, TIER_SAMPLE, token1.address))
                .to.emit(erc721OpenSale, "OnBuy")
                .withArgs(
                    deployer,
                    erc721OverProxy.address,
                    TIER_SAMPLE,
                    TIER_SAMPLE_PRICE,
                    token1.address,
                    "ERC20_SALE",
                    []
                )
        })
    })
})
