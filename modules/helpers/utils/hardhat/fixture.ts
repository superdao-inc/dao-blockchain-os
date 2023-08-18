import { ethers, deployments, getNamedAccounts } from "hardhat"
import { ClaimAppIds, factoryMapping, SaleAppIds } from "@constants//"
import { AppsIds, BASE_NAME, BASE_SYMBOL, BASE_URI } from "@utils/const"
import { BigNumber, BigNumberish, Bytes, BytesLike } from "ethers"
import daos from "@scripts/input/sample-create-dao.json"
import { AdminSettingsStruct, DeploymentSettingsStruct, SaleSettingsStruct } from "@typechain-types/DAOConstructor"
import GnosisSafe from "@gnosis.pm/safe-contracts/build/artifacts/contracts/GnosisSafeL2.sol/GnosisSafeL2.json"
import { hrtime } from "process"

const SAMPLE_TIER: BytesLike = ethers.utils.formatBytes32String("SAMPLE")

export type FixtureProps = {
    saleType?: keyof typeof SaleAppIds
    claimType?: keyof typeof ClaimAppIds | null
    tiers?: BytesLike[] | Bytes[]
    claimLimits?: BigNumberish[] | BigNumber[]
}

export const deploymentFixture = ({ tiers = [SAMPLE_TIER], claimLimits = [1] }: FixtureProps) =>
    deployments.createFixture(async () => {
        await deployments.fixture(["local", "UniswapV3Oracle", "implementations", "protocol"])

        const { releaseManager, successTeam } = await getNamedAccounts()
        const releaseManagerSigner = await ethers.getSigner(releaseManager)
        const successTeamSigner = await ethers.getSigner(successTeam)

        const callForwarder = await ethers.getContractAt(
            "CallForwarder",
            (
                await deployments.get("CallForwarder")
            ).address
        )

        const uniswapV3Factory = await ethers.getContractAt(
            "IUniswapV3Factory",
            (
                await deployments.get("UniswapV3Factory")
            ).address
        )
        const uniswapV3Oracle = await ethers.getContractAt(
            "UniswapV3Oracle",
            (
                await deployments.get("UniswapV3OracleProxy")
            ).address
        )

        const updateManager = await ethers.getContractAt(
            "UpdateManager",
            (
                await deployments.get("UpdateManagerProxy")
            ).address
        )

        const daoConstructor = await ethers.getContractAt(
            "DAOConstructor",
            (
                await deployments.get("DAOConstructorProxy")
            ).address
        )

        const erc721WhitelistClaimImpl = await ethers.getContractAt(
            "ERC721WhitelistClaim",
            (
                await deployments.get("ERC721WhitelistClaim")
            ).address
        )
        let kernel = await ethers.getContractAt("Kernel", (await deployments.get("Kernel")).address)
        await updateManager.connect(releaseManagerSigner).setAppCode(AppsIds.KERNEL, kernel.address)

        const mockAppFactory = await ethers.getContractFactory("MockApp")
        const ERC721LinkClaim = await ethers.getContractFactory("ERC721LinkClaim")
        const MockVRFCoordinatorFactory = await ethers.getContractFactory("MockVRFCoordinator")
        const tokenFactory = await ethers.getContractFactory("MockERC20")

        const mockAppImpl = await mockAppFactory.deploy(callForwarder.address)
        const erc721LinkClaimImpl = await ERC721LinkClaim.deploy(callForwarder.address)
        const mockVRFCoordinator = await MockVRFCoordinatorFactory.deploy()
        const mockToken = await tokenFactory.deploy("Token1", "TOK1")

        await erc721LinkClaimImpl.deployed()
        await mockAppImpl.deployed()
        await mockVRFCoordinator.deployed()

        await updateManager
            .connect(releaseManagerSigner)
            .setAppCode(AppsIds.ERC721_LINK_CLAIM, erc721LinkClaimImpl.address)
        await updateManager
            .connect(releaseManagerSigner)
            .setAppCode(AppsIds.ERC721_WHITELIST_CLAIM, erc721WhitelistClaimImpl.address)

        await updateManager
            .connect(releaseManagerSigner)
            .deployBeaconByIds([
                AppsIds.ADMIN_CONTROLLER,
                AppsIds.ERC721,
                AppsIds.ERC721_LINK_CLAIM,
                AppsIds.ERC721_OPEN_SALE,
                AppsIds.ERC721_WHITELIST_CLAIM,
                AppsIds.ERC721_WHITELIST_SALE,
                AppsIds.KERNEL,
            ])

        const dao = daos[0]

        dao.deploymentSettings.nftSettings.name = BASE_NAME
        dao.deploymentSettings.nftSettings.symbol = BASE_SYMBOL
        dao.deploymentSettings.nftSettings.url = BASE_URI

        const adminSettings: AdminSettingsStruct = {
            admins: dao.deploymentSettings.adminSettings.admins,
            creator: dao.deploymentSettings.adminSettings.creator,
            releaseManager,
        }
        const emptySaleSettings: SaleSettingsStruct = {
            tiersValues: [],
            tiersPrices: [],
            claimLimit: 0,
            tokenSaleAddress: mockToken.address,
        }

        const settings: DeploymentSettingsStruct = {
            adminSettings,
            nftSettings: dao.deploymentSettings.nftSettings,
            openSaleSettings: emptySaleSettings,
            whiteListSaleSettings: emptySaleSettings,
        }
        const tx = await daoConstructor.deploy([0, 1], settings, ethers.constants.AddressZero)
        const result = await tx.wait()

        for (const event of result.events!) {
            if (event.event === "Deployed") {
                const kernelAddr = event.args!.kernel
                kernel = await ethers.getContractAt("Kernel", kernelAddr)
            }
        }

        const treasuryAddr = await kernel.getTreasury()
        const treasury = await ethers.getContractAt(GnosisSafe.abi, treasuryAddr)

        let initData = erc721WhitelistClaimImpl.interface.encodeFunctionData("initialize", [
            kernel.address,
            tiers,
            claimLimits,
        ])

        // await kernel.migrateApps([
        //     AppsIds.ADMIN_CONTROLLER,
        //     AppsIds.ERC721,
        //     AppsIds.ERC721_LINK_CLAIM,
        //     AppsIds.ERC721_OPEN_SALE,
        //     AppsIds.ERC721_WHITELIST_CLAIM,
        //     AppsIds.ERC721_WHITELIST_SALE,
        //     AppsIds.KERNEL,
        // ])

        kernel = kernel.connect(successTeamSigner)
        await kernel.deployApp(AppsIds.ERC721_WHITELIST_CLAIM, initData)
        await kernel.addPermission(AppsIds.SUDO, AppsIds.ERC721_WHITELIST_CLAIM, 0)
        await kernel.addPermission(AppsIds.RELEASE_MANAGER, AppsIds.ERC721_WHITELIST_CLAIM, 0)
        await kernel.addPermission(AppsIds.ERC721_WHITELIST_CLAIM, AppsIds.ERC721, 0)

        initData = erc721LinkClaimImpl.interface.encodeFunctionData("initialize", [kernel.address])
        await kernel.deployApp(AppsIds.ERC721_LINK_CLAIM, initData)
        await kernel.addPermission(AppsIds.SUDO, AppsIds.ERC721_LINK_CLAIM, 0)
        await kernel.addPermission(AppsIds.RELEASE_MANAGER, AppsIds.ERC721_LINK_CLAIM, 0)
        await kernel.addPermission(AppsIds.ERC721_LINK_CLAIM, AppsIds.ERC721, 0)

        const data = mockAppImpl.interface.encodeFunctionData("initialize", [kernel.address])
        await updateManager.connect(releaseManagerSigner).setAppCode(AppsIds.MOCKAPP, mockAppImpl.address)
        await updateManager.connect(releaseManagerSigner).deployBeaconById(AppsIds.MOCKAPP)
        await kernel.deployApp(AppsIds.MOCKAPP, data)

        const app = await ethers.getContractAt("MockApp", await kernel.getAppAddress(AppsIds.MOCKAPP))
        const erc721 = await ethers.getContractAt("ERC721Properties", await kernel.getAppAddress(AppsIds.ERC721))
        const erc721OpenSale = await ethers.getContractAt(
            "ERC721OpenSale",
            await kernel.getAppAddress(AppsIds.ERC721_OPEN_SALE)
        )
        const erc721WhitelistSale = await ethers.getContractAt(
            "ERC721WhitelistSale",
            await kernel.getAppAddress(AppsIds.ERC721_WHITELIST_SALE)
        )
        const erc721WhitelistClaim = await ethers.getContractAt(
            "ERC721WhitelistClaim",
            await kernel.getAppAddress(AppsIds.ERC721_WHITELIST_CLAIM)
        )
        const erc721LinkClaim = await ethers.getContractAt(
            "ERC721LinkClaim",
            await kernel.getAppAddress(AppsIds.ERC721_LINK_CLAIM)
        )
        const adminController = await ethers.getContractAt(
            "AdminController",
            await kernel.getAppAddress(AppsIds.ADMIN_CONTROLLER)
        )
        await kernel.addPermission(AppsIds.MOCKAPP, AppsIds.ERC721, 0)
        await kernel.addPermission(AppsIds.SUDO, AppsIds.KERNEL, 0)

        return {
            kernel,
            erc721,
            updateManager,
            erc721WhitelistSale,
            erc721WhitelistClaim,
            erc721LinkClaim,
            app,
            mockApp: mockAppImpl,
            callForwarder,
            mockVRFCoordinator,
            erc721OpenSale,
            uniswapV3Factory,
            uniswapV3Oracle,
            treasury,
            adminController,
        }
    })
