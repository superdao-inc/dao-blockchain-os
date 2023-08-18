import { expect } from "chai"
import { deployments, ethers, getNamedAccounts } from "hardhat"
import { MockApp, Kernel, UpdateManager, ERC721Properties, CallForwarder } from "@typechain-types//"
import {
    AuthorizationException,
    InitEvent,
    AlreadyInitializedException,
    KernelContract,
    MockAppContract,
    UpgradeEvent,
} from "@utils/const"
import { DOMAIN, VERSION } from "@constants/appsIds"

xdescribe("App", () => {
    let deploymentFixture: () => any

    let app: MockApp
    let kernel: Kernel
    let callForwarder: CallForwarder
    before(async () => {
        deploymentFixture = deployments.createFixture(async () => {
            const { deployer, releaseManager } = await getNamedAccounts()
            await deployments.fixture()
            // TODO: Import safe's contracts from fixtures?
            const SafeSingleton = ethers.constants.AddressZero
            const SafeFactory = ethers.constants.AddressZero
            const SafeFallbackHandler = ethers.constants.AddressZero

            const callForwarderFactory = await ethers.getContractFactory("CallForwarder")
            callForwarder = (await callForwarderFactory.deploy(DOMAIN, VERSION)) as CallForwarder

            const appFactory = await ethers.getContractFactory(MockAppContract)
            app = (await appFactory.deploy(callForwarder.address)) as MockApp
            const kernelFactory = await ethers.getContractFactory("Kernel")
            const updateManagerFactory = await ethers.getContractFactory("UpdateManager")
            const updateManager = await updateManagerFactory.deploy()
            kernel = (await kernelFactory.deploy(
                callForwarder.address,
                updateManager.address,
                SafeSingleton,
                SafeFactory,
                SafeFallbackHandler
            )) as Kernel
            await kernel.initialize(deployer, releaseManager)
        })
    })

    beforeEach(async () => {
        await deploymentFixture()
    })

    describe("#initialize", () => {
        it("emits Init event", async () => {
            const { deployer } = await getNamedAccounts()
            await expect(app.initialize(deployer)).to.emit(app, InitEvent).withArgs(deployer)
        })

        describe("when initialize called second time", () => {
            it("reverts", async () => {
                const { deployer } = await getNamedAccounts()
                await app.initialize(deployer)
                await expect(app.initialize(deployer)).to.be.revertedWith(AlreadyInitializedException)
            })
        })
    })

    describe("#kernel", () => {
        it("stores the kernel as a public variable", async () => {
            await app.initialize(kernel.address)
            expect(await app.kernel()).to.eq(kernel.address)
        })
    })

    describe("#upgrade", () => {
        it("emits Upgrade event", async () => {
            const { deployer } = await getNamedAccounts()
            await app.initialize(deployer)
            await expect(app.upgrade(deployer)).to.emit(app, UpgradeEvent).withArgs(deployer)
        })

        describe("when not a kernel tries to upgrade", () => {
            it("reverts", async () => {
                const { deployer } = await getNamedAccounts()
                await app.initialize(ethers.constants.AddressZero)
                await expect(app.upgrade(deployer)).to.be.revertedWith(AuthorizationException)
            })
        })
    })

    describe("#implementation", () => {
        it("returns implementation", async () => {
            const { deployer } = await getNamedAccounts()
            await app.initialize(deployer)
            await app.upgrade(deployer)
            await expect(await app.implementation()).to.eq(deployer)
        })
    })

    describe("#testPermission", () => {
        describe("when address has required permission", async () => {
            it("doesn't revert", async () => {
                const { deployer, releaseManager, oracle } = await getNamedAccounts()

                const UpdateManager = await ethers.getContractFactory("UpdateManager")
                const Kernel = await ethers.getContractFactory("Kernel")
                const ERC721BaseSale = await ethers.getContractFactory("ERC721BaseSale")
                const ERC721OpenSale = await ethers.getContractFactory("ERC721OpenSale")
                const ERC721WhitelistSale = await ethers.getContractFactory("ERC721WhitelistSale")
                const ERC721Properties = await ethers.getContractFactory("ERC721Properties")
                const MockApp = await ethers.getContractFactory("MockApp")
                // TODO: Import safe's contracts from fixtures?
                const SafeSingleton = ethers.constants.AddressZero
                const SafeFactory = ethers.constants.AddressZero
                const SafeFallbackHandler = ethers.constants.AddressZero

                const updateManager = await UpdateManager.deploy()
                await updateManager.deployed()

                const kernel = await Kernel.deploy(
                    callForwarder.address,
                    updateManager.address,
                    SafeSingleton,
                    SafeFactory,
                    SafeFallbackHandler
                )
                await kernel.deployed()

                const erc721BaseSale = await ERC721BaseSale.deploy(callForwarder.address)
                await erc721BaseSale.deployed()

                const erc721OpenSale = await ERC721OpenSale.deploy(callForwarder.address, oracle)
                await erc721OpenSale.deployed()

                const erc721WhitelistSale = await ERC721WhitelistSale.deploy(callForwarder.address)
                await erc721WhitelistSale.deployed()

                const erc721Properties = (await ERC721Properties.deploy(callForwarder.address)) as ERC721Properties
                await erc721Properties.deployed()

                await kernel.initialize(deployer, releaseManager)

                await erc721OpenSale.initialize(kernel.address)
                await erc721WhitelistSale.initialize(kernel.address, 1)

                await updateManager.initialize(
                    kernel.address,
                    deployer,
                    erc721BaseSale.address,
                    erc721OpenSale.address,
                    erc721WhitelistSale.address
                )

                const app1 = (await MockApp.deploy(callForwarder.address)) as MockApp
                await app1.deployed()

                await app1.initialize(kernel.address)

                const app2 = (await MockApp.deploy(callForwarder.address)) as MockApp
                await app2.deployed()

                await app2.initialize(kernel.address)

                const appId1 = ethers.utils.formatBytes32String("app1")
                const appId2 = ethers.utils.formatBytes32String("app2")

                await kernel.connectApp(appId1, app1.address, false)
                await kernel.connectApp(appId2, app2.address, false)

                await kernel.addPermission(appId1, appId2, 0)

                await expect(app1.callTestRequireSUDO(app2.address)).not.to.be.reverted
            })
        })

        describe("when accessed by not permitted address", async () => {
            it("reverts", async () => {
                const { deployer, releaseManager, oracle } = await getNamedAccounts()

                const UpdateManager = await ethers.getContractFactory("UpdateManager")
                const Kernel = await ethers.getContractFactory("Kernel")
                const ERC721BaseSale = await ethers.getContractFactory("ERC721BaseSale")
                const ERC721OpenSale = await ethers.getContractFactory("ERC721OpenSale")
                const ERC721WhitelistSale = await ethers.getContractFactory("ERC721WhitelistSale")
                const ERC721Properties = await ethers.getContractFactory("ERC721Properties")
                const MockApp = await ethers.getContractFactory("MockApp")

                const SafeSingleton = ethers.constants.AddressZero
                const SafeFactory = ethers.constants.AddressZero
                const SafeFallbackHandler = ethers.constants.AddressZero

                const updateManager = (await UpdateManager.deploy()) as UpdateManager
                await updateManager.deployed()

                const kernel = (await Kernel.deploy(
                    callForwarder.address,
                    updateManager.address,
                    SafeSingleton,
                    SafeFactory,
                    SafeFallbackHandler
                )) as Kernel
                await kernel.deployed()

                const erc721BaseSale = await ERC721BaseSale.deploy(callForwarder.address)
                await erc721BaseSale.deployed()

                const erc721OpenSale = await ERC721OpenSale.deploy(callForwarder.address, oracle)
                await erc721OpenSale.deployed()

                const erc721WhitelistSale = await ERC721WhitelistSale.deploy(callForwarder.address)
                await erc721WhitelistSale.deployed()

                const erc721Properties = (await ERC721Properties.deploy(callForwarder.address)) as ERC721Properties
                await erc721Properties.deployed()

                await kernel.initialize(deployer, releaseManager)

                await erc721OpenSale.initialize(kernel.address)
                await erc721WhitelistSale.initialize(kernel.address, 1)

                await updateManager.initialize(
                    kernel.address,
                    deployer,
                    erc721BaseSale.address,
                    erc721OpenSale.address,
                    erc721WhitelistSale.address
                )

                const app1 = (await MockApp.deploy(callForwarder.address)) as MockApp
                await app1.deployed()

                await app1.initialize(kernel.address)

                const app2 = (await MockApp.deploy(callForwarder.address)) as MockApp
                await app2.deployed()

                await app2.initialize(kernel.address)

                const appId1 = ethers.utils.formatBytes32String("app1")
                const appId2 = ethers.utils.formatBytes32String("app2")

                await kernel.connectApp(appId1, app1.address, false)
                await kernel.connectApp(appId2, app2.address, false)

                await expect(app1.callTestRequireSUDO(app2.address)).to.be.revertedWith(AuthorizationException)
            })
        })
    })
})
