import { expect } from "chai"
import { ethers, getNamedAccounts } from "hardhat"
import { AppsIds, InterfaceIds } from "@utils/const"
import { encodeAppId } from "@utils//"
import { Exceptions, VERSION, DOMAIN, factoryMapping } from "@constants//"

import { App, CallForwarder, Kernel, MockApp, UpdateManager } from "@typechain-types//"
import { Wallet } from "ethers"

import { deploymentFixture } from "@utils/hardhat"

const defaultApp1Name = "MockApp" // todo: use this when refactor current module
const defaultApp2Name = "MockApp-2"

describe("Kernel [kernel]", () => {
    let fixture: () => Promise<void>
    let mockApp: MockApp
    let kernel: Kernel
    let updateManager: UpdateManager
    let callForwarder: CallForwarder
    before(async () => {
        fixture = async () => {
            const fixtureFunction = deploymentFixture({})

            const callForwarderFactory = await ethers.getContractFactory("CallForwarder")
            callForwarder = (await callForwarderFactory.deploy(DOMAIN, VERSION)) as CallForwarder

            const { kernel: fkernel, updateManager: fupdateManager, mockApp: fmockApp } = await fixtureFunction()

            kernel = fkernel
            mockApp = fmockApp
            updateManager = fupdateManager
            mockApp = fmockApp
        }
    })

    beforeEach(async () => {
        await fixture()
    })

    describe("AppManager", () => {
        describe("#getAppAddress", () => {
            it("gets app address", async () => {
                const appId = ethers.utils.formatBytes32String("MockApp")
                await kernel.connectApp(appId, mockApp.address, true)
                expect(await kernel.getAppAddress(appId)).to.eq(mockApp.address)
            })
        })

        describe("#connectApp", () => {
            it("connects app", async () => {
                const appId = ethers.utils.formatBytes32String("MockApp")
                await kernel.connectApp(appId, mockApp.address, true)
                expect(await kernel.getAppAddress(appId)).to.eq(mockApp.address)
            })

            describe("when trying to connect an app with the same appId or address", () => {
                it(`reverts with ${Exceptions.APP_WAS_INITED_ERROR}`, async () => {
                    const stranger = ethers.Wallet.createRandom()

                    const appId = ethers.utils.formatBytes32String("MockApp")
                    const anotherAppId = ethers.utils.formatBytes32String("MockApp-2")
                    await kernel.connectApp(appId, mockApp.address, true)

                    await expect(kernel.connectApp(appId, stranger.address, true)).to.be.revertedWith(
                        Exceptions.APP_WAS_INITED_ERROR
                    )
                    await expect(kernel.connectApp(anotherAppId, mockApp.address, true)).to.be.revertedWith(
                        Exceptions.APP_WAS_INITED_ERROR
                    )
                })
            })

            describe("when msg.sender is random address", () => {
                it(`reverts with ${Exceptions.INVALID_AUTHORIZATION_ERROR}`, async () => {
                    const stranger = ethers.Wallet.createRandom()
                    const appId = ethers.utils.formatBytes32String("MockApp")
                    const strangerKernel = kernel.connect(stranger)
                    await expect(strangerKernel.connectApp(appId, stranger.address, true)).to.be.reverted
                })
            })
        })

        describe("#resetApp", () => {
            it("resets app", async () => {
                const stranger = ethers.Wallet.createRandom()
                const appId = ethers.utils.formatBytes32String("MockApp")
                await kernel.connectApp(appId, mockApp.address, false)
                await kernel.resetApp(appId, stranger.address, true)
                expect(await kernel.getAppAddress(appId)).to.eq(stranger.address)
            })

            it("revert when address associates with existed app", async () => {
                const anotherStranger = ethers.Wallet.createRandom()
                const appId = ethers.utils.formatBytes32String("MockApp")
                await kernel.connectApp(appId, mockApp.address, false)
                const appStrangerId = ethers.utils.formatBytes32String("MockAppStranger")
                await kernel.connectApp(appStrangerId, anotherStranger.address, false)
                await expect(kernel.resetApp(appId, anotherStranger.address, true)).to.be.revertedWith(
                    "ADDRESS_ASSOCIATES_WITH_APP"
                )
            })

            describe("when resetting non-existing appId", () => {
                it("doesn't revert", async () => {
                    const fakeAppId = ethers.utils.formatBytes32String("FakeApp")
                    expect(await kernel.getAppAddress(fakeAppId)).to.eq(ethers.constants.AddressZero)
                    await expect(kernel.resetApp(fakeAppId, mockApp.address, true)).to.be.not.reverted
                })
            })

            describe("when msg.sender is random address", () => {
                it("reverts", async () => {
                    const stranger = ethers.Wallet.createRandom()
                    const appId = ethers.utils.formatBytes32String("MockApp")
                    await kernel.connectApp(appId, mockApp.address, false)
                    await kernel.resetApp(appId, stranger.address, true)
                    await expect(kernel.connect(stranger).resetApp(appId, mockApp.address, true)).to.be.reverted
                })
            })
        })

        describe("#deployApp", () => {
            it("deploys app", async () => {
                const { deployer, releaseManager } = await getNamedAccounts()
                const manager = await kernel.getUpdateManager()
                expect(manager).not.to.eq(ethers.constants.AddressZero)

                const erc721Factory = await ethers.getContractFactory("ERC721Properties")

                const erc721 = await erc721Factory.deploy(callForwarder.address)
                await erc721.deployed()
                const appId = encodeAppId("ERC721Test")

                const calldata = erc721.interface.encodeFunctionData("initialize", [
                    {
                        kernel: kernel.address,
                        openseaOwner: deployer,
                        baseURI: "baseURI",
                        name: "Name",
                        symbol: "SYM",
                    },
                ])

                const releaseManagerSigner = await ethers.getSigner(releaseManager)
                await updateManager.connect(releaseManagerSigner).setAppCode(appId, erc721.address)
                await updateManager.connect(releaseManagerSigner).deployBeaconById(appId)
                await kernel.deployApp(appId, calldata)
                expect(await kernel.getAppAddress(appId)).not.to.equal(ethers.constants.AddressZero)
            })

            it("deploy app, initialize and configure", async () => {
                const { deployer } = await getNamedAccounts()
                const erc721Factory = await ethers.getContractFactory("ERC721Properties")
                const erc721 = await erc721Factory.deploy(callForwarder.address)
                await erc721.deployed()
                const appId = encodeAppId("ERC721test1")

                const appABI = erc721.interface
                const kernelABI = kernel.interface
                const initData = appABI.encodeFunctionData("initialize", [
                    {
                        kernel: kernel.address,
                        openseaOwner: deployer,
                        baseURI: "baseURI",
                        name: "Name",
                        symbol: "SYM",
                    },
                ])

                const kernelData1 = kernelABI.encodeFunctionData("addPermission", [AppsIds.SUDO, appId, 0])
                const kernelData2 = kernelABI.encodeFunctionData("addPermission", [AppsIds.ADMIN_CONTROLLER, appId, 0])
                const kernelData3 = kernelABI.encodeFunctionData("addPermission", [AppsIds.RELEASE_MANAGER, appId, 0])
                const kernelData4 = kernelABI.encodeFunctionData("addPermission", [AppsIds.KERNEL, appId, 0])

                const proxyData = appABI.encodeFunctionData("setName", ["NEWNAME"])

                const { releaseManager } = await getNamedAccounts()
                const releaseManagerSigner = await ethers.getSigner(releaseManager)
                let tx = await updateManager.connect(releaseManagerSigner).setAppCode(appId, erc721.address)
                await tx.wait()
                await updateManager.connect(releaseManagerSigner).deployBeaconById(appId)

                tx = await kernel.deployAndConfigure(
                    appId,
                    initData,
                    [kernelData1, kernelData2, kernelData3, kernelData4],
                    [proxyData]
                )
                await tx.wait()

                const proxyAddress = await kernel.getAppAddress(appId)
                const proxy = await ethers.getContractAt(factoryMapping.ERC721, proxyAddress)
                expect(await kernel.getAppAddress(appId)).not.to.equal(ethers.constants.AddressZero)
                expect(await proxy.name()).is.equal("NEWNAME")
                expect(
                    await kernel.hasPermission(await kernel.getAppAddress(AppsIds.ADMIN_CONTROLLER), proxyAddress, 0)
                ).is.equal(true)
            })

            describe("when beacon call is not successful", () => {
                it("reverts", async () => {
                    const { releaseManager } = await getNamedAccounts()
                    const myAppId = ethers.utils.formatBytes32String("MyApp")
                    const MockApp = await ethers.getContractFactory("MockApp")
                    const mockApp = await MockApp.deploy(callForwarder.address)
                    await mockApp.deployed()
                    const releaseManagerSigner = await ethers.getSigner(releaseManager)
                    await updateManager.connect(releaseManagerSigner).setAppCode(myAppId, mockApp.address)
                    await updateManager.connect(releaseManagerSigner).deployBeaconById(myAppId)
                    await expect(kernel.deployApp(myAppId, myAppId)).to.be.reverted
                })
            })

            describe("when msg.sender is random address", () => {
                it("reverts", async () => {
                    const stranger = ethers.Wallet.createRandom()
                    const myAppId = ethers.utils.formatBytes32String("MyApp")
                    const MockApp = await ethers.getContractFactory("MockApp")
                    const mockApp = await MockApp.deploy(callForwarder.address)
                    await mockApp.deployed()
                    await expect(kernel.connect(stranger).deployApp(myAppId, myAppId)).to.be.reverted
                })
            })
        })
    })

    describe("ACL", () => {
        describe("#getPermissions", () => {
            it("returns permissions", async () => {
                const appId = ethers.utils.formatBytes32String("MockApp")
                const anotherAppId = ethers.utils.formatBytes32String("MockApp2")
                await kernel.connectApp(appId, mockApp.address, true)

                const mockApp2 = await (await ethers.getContractFactory("MockApp")).deploy(callForwarder.address)
                await kernel.connectApp(anotherAppId, mockApp2.address, true)
                const permissions = await kernel.getPermissions(appId, anotherAppId)
                expect(permissions).to.eq("0x0000")
            })

            describe("when msg.sender is random address", () => {
                it("reverts", async () => {
                    const stranger = ethers.Wallet.createRandom()
                    const anotherStranger = ethers.Wallet.createRandom()
                    const appId = ethers.utils.formatBytes32String("MockApp")
                    const anotherAppId = ethers.utils.formatBytes32String("MockApp-2")
                    await kernel.connectApp(appId, stranger.address, true)
                    await kernel.connectApp(anotherAppId, anotherStranger.address, true)
                    await expect(kernel.connect(stranger).getPermissions(appId, anotherAppId)).to.be.reverted
                })
            })
        })

        describe("#hasPermission", () => {
            it("returns true if permission is granted", async () => {
                const stranger = ethers.Wallet.createRandom()
                const anotherStranger = ethers.Wallet.createRandom()
                const appId = ethers.utils.formatBytes32String("MockApp")
                const anotherAppId = ethers.utils.formatBytes32String("MockApp-2")
                await kernel.connectApp(appId, stranger.address, true)
                await kernel.connectApp(anotherAppId, anotherStranger.address, true)

                await kernel.addPermission(appId, anotherAppId, 1)
                expect(await kernel.hasPermission(stranger.address, anotherStranger.address, 1)).to.be.true
            })

            it("returns false if permission is not granted", async () => {
                const stranger = ethers.Wallet.createRandom()
                const anotherStranger = ethers.Wallet.createRandom()
                const appId = ethers.utils.formatBytes32String("MockApp")
                const anotherAppId = ethers.utils.formatBytes32String("MockApp-2")
                await kernel.connectApp(appId, stranger.address, true)
                await kernel.connectApp(anotherAppId, anotherStranger.address, true)
                expect(await kernel.hasPermission(stranger.address, anotherStranger.address, 1)).to.be.false
            })

            it("returns false for not registered app if permission is granted to bytes32(0) ", async () => {
                const stranger = ethers.Wallet.createRandom()
                const anotherStranger = ethers.Wallet.createRandom()

                const anotherAppId = ethers.utils.formatBytes32String("")

                await kernel.connectApp(anotherAppId, anotherStranger.address, true)
                await kernel.addPermission(
                    "0x0000000000000000000000000000000000000000000000000000000000000000",
                    anotherAppId,
                    1
                )
                expect(await kernel.hasPermission(stranger.address, anotherStranger.address, 1)).to.be.false
            })

            describe("when msg.sender is random address", () => {
                it("reverts", async () => {
                    const stranger = ethers.Wallet.createRandom()
                    const appId = ethers.utils.formatBytes32String("MockApp")
                    const anotherAppId = ethers.utils.formatBytes32String("MockApp-2")
                    await expect(kernel.connect(stranger).hasPermission(appId, anotherAppId, 1)).to.be.reverted
                })
            })

            describe("when appAddress is random", () => {
                it(`returns false`, async () => {
                    const stranger = ethers.Wallet.createRandom()
                    const anotherStranger = ethers.Wallet.createRandom()
                    const randomStranger = ethers.Wallet.createRandom()
                    const appId = ethers.utils.formatBytes32String("MockApp")
                    const anotherAppId = ethers.utils.formatBytes32String("MockApp-2")
                    await kernel.connectApp(appId, stranger.address, true)
                    await kernel.connectApp(anotherAppId, anotherStranger.address, true)

                    await kernel.addPermission(appId, anotherAppId, 1)
                    expect(await kernel.hasPermission(stranger.address, randomStranger.address, 1)).to.be.false
                })
            })

            describe("when entityAddress is random", () => {
                it(`returns false`, async () => {
                    const stranger = ethers.Wallet.createRandom()
                    const anotherStranger = ethers.Wallet.createRandom()
                    const randomStranger = ethers.Wallet.createRandom()
                    const appId = ethers.utils.formatBytes32String("MockApp")
                    const anotherAppId = ethers.utils.formatBytes32String("MockApp-2")
                    await kernel.connectApp(appId, stranger.address, true)
                    await kernel.connectApp(anotherAppId, anotherStranger.address, true)

                    await kernel.addPermission(appId, anotherAppId, 1)
                    expect(await kernel.hasPermission(randomStranger.address, anotherStranger.address, 1)).to.be.false
                })
            })

            async function _create2KernelDefaultAppsWithPermissionOf1to2(): Promise<[Wallet, Wallet]> {
                const stranger = ethers.Wallet.createRandom()
                const anotherStranger = ethers.Wallet.createRandom()
                const _appId = ethers.utils.formatBytes32String(defaultApp1Name)
                const _anotherAppId = ethers.utils.formatBytes32String(defaultApp2Name)
                await kernel.connectApp(_appId, stranger.address, true)
                await kernel.connectApp(_anotherAppId, anotherStranger.address, true)
                await kernel.addPermission(_appId, _anotherAppId, 1)
                return [stranger, anotherStranger]
            }

            describe("after kernel.resetApp called for entityAddress", () => {
                //  i.e. we match entityAddress with defaultApp1Name
                describe("when entityAddress is new address", () => {
                    it(`returns true`, async () => {
                        const [, anotherStranger] = await _create2KernelDefaultAppsWithPermissionOf1to2()
                        const newStranger = ethers.Wallet.createRandom()
                        await kernel.resetApp(
                            ethers.utils.formatBytes32String(defaultApp1Name),
                            newStranger.address,
                            true
                        )
                        expect(await kernel.hasPermission(newStranger.address, anotherStranger.address, 1)).to.be.true
                    })
                })

                describe("when entityAddress is random address", () => {
                    it(`returns false`, async () => {
                        const [, anotherStranger] = await _create2KernelDefaultAppsWithPermissionOf1to2()
                        const newStranger = ethers.Wallet.createRandom()
                        const randomStranger = ethers.Wallet.createRandom()
                        await kernel.resetApp(
                            ethers.utils.formatBytes32String(defaultApp1Name),
                            newStranger.address,
                            true
                        )
                        expect(await kernel.hasPermission(randomStranger.address, anotherStranger.address, 1)).to.be
                            .false
                    })
                })

                describe("when entityAddress is old address", () => {
                    it(`returns false`, async () => {
                        const [stranger, anotherStranger] = await _create2KernelDefaultAppsWithPermissionOf1to2()
                        const newStranger = ethers.Wallet.createRandom()
                        await kernel.resetApp(
                            ethers.utils.formatBytes32String(defaultApp1Name),
                            newStranger.address,
                            true
                        )
                        expect(await kernel.hasPermission(stranger.address, anotherStranger.address, 1)).to.be.false
                    })
                })
            })

            describe("after kernel.resetApp called for appAddress", () => {
                //  i.e. we match appAddress with defaultApp2Name
                describe("when appAddress is new address", () => {
                    it(`returns true`, async () => {
                        const [stranger] = await _create2KernelDefaultAppsWithPermissionOf1to2()
                        const newStranger = ethers.Wallet.createRandom()
                        await kernel.resetApp(
                            ethers.utils.formatBytes32String(defaultApp2Name),
                            newStranger.address,
                            true
                        )
                        expect(await kernel.hasPermission(stranger.address, newStranger.address, 1)).to.be.true
                    })
                })

                describe("when appAddress is random address", () => {
                    it(`returns false`, async () => {
                        const [stranger] = await _create2KernelDefaultAppsWithPermissionOf1to2()
                        const newStranger = ethers.Wallet.createRandom()
                        const randomStranger = ethers.Wallet.createRandom()
                        await kernel.resetApp(
                            ethers.utils.formatBytes32String(defaultApp2Name),
                            newStranger.address,
                            true
                        )
                        expect(await kernel.hasPermission(stranger.address, randomStranger.address, 1)).to.be.false
                    })
                })

                describe("when appAddress is old address", () => {
                    it(`returns false`, async () => {
                        const [stranger, anotherStranger] = await _create2KernelDefaultAppsWithPermissionOf1to2()
                        const newStranger = ethers.Wallet.createRandom()
                        await kernel.resetApp(
                            ethers.utils.formatBytes32String(defaultApp2Name),
                            newStranger.address,
                            true
                        )
                        expect(await kernel.hasPermission(stranger.address, anotherStranger.address, 1)).to.be.false
                    })
                })
            })
        })

        describe("#addPermission", () => {
            it("adds permission", async () => {
                const stranger = ethers.Wallet.createRandom()
                const anotherStranger = ethers.Wallet.createRandom()
                const appId = ethers.utils.formatBytes32String("MockApp")
                const anotherAppId = ethers.utils.formatBytes32String("MockApp-2")
                await kernel.connectApp(appId, stranger.address, true)
                await kernel.connectApp(anotherAppId, anotherStranger.address, true)

                await kernel.addPermission(appId, anotherAppId, 1)
                expect(await kernel.hasPermission(stranger.address, anotherStranger.address, 1)).to.be.true
            })

            describe("when msg.sender is random address", () => {
                it("reverts", async () => {
                    const stranger = ethers.Wallet.createRandom()
                    const appId = ethers.utils.formatBytes32String("MockApp")
                    const anotherAppId = ethers.utils.formatBytes32String("MockApp-2")
                    await expect(kernel.connect(stranger).addPermission(appId, anotherAppId, 1)).to.be.reverted
                })
            })
        })

        describe("#removePermission", () => {
            it("removes permission", async () => {
                const stranger = ethers.Wallet.createRandom()
                const anotherStranger = ethers.Wallet.createRandom()
                const appId = ethers.utils.formatBytes32String("MockApp")
                const anotherAppId = ethers.utils.formatBytes32String("MockApp-2")
                await kernel.connectApp(appId, stranger.address, true)
                await kernel.connectApp(anotherAppId, anotherStranger.address, true)

                await kernel.addPermission(appId, anotherAppId, 1)
                await kernel.removePermission(appId, anotherAppId, 1)
                expect(await kernel.hasPermission(stranger.address, anotherStranger.address, 1)).to.be.false
            })

            describe("when msg.sender is random address", () => {
                it("reverts", async () => {
                    const stranger = ethers.Wallet.createRandom()
                    const appId = ethers.utils.formatBytes32String("MockApp")
                    const anotherAppId = ethers.utils.formatBytes32String("MockApp-2")
                    await expect(kernel.connect(stranger).removePermission(appId, anotherAppId, 1)).to.be.reverted
                })
            })
        })
    })

    describe("Kernel", () => {
        describe("#getUpdateManager", () => {
            it("returns update manager address", async () => {
                expect(await kernel.getUpdateManager()).not.to.eq(ethers.constants.AddressZero)
            })

            it("manager address is a contract", async () => {
                const manager = await kernel.getUpdateManager()
                await expect(ethers.getContractAt("UpdateManager", manager)).not.to.be.reverted
            })

            describe("when msg.sender is random address", () => {
                it("reverts", async () => {
                    const stranger = ethers.Wallet.createRandom()
                    await expect(kernel.connect(stranger).getUpdateManager()).to.be.reverted
                })
            })
        })

        describe("#upgradeApp", () => {
            it("upgrades app", async () => {
                const managerAddress = await kernel.getUpdateManager()
                expect(managerAddress).not.to.eq(ethers.constants.AddressZero)
                expect(managerAddress).to.eq(updateManager.address)

                const erc721Factory = await ethers.getContractFactory("ERC721Properties")

                const myErc721 = await erc721Factory.deploy(callForwarder.address)
                await myErc721.deployed()
                const appId = AppsIds.ERC721
                const { releaseManager } = await getNamedAccounts()
                const releaseManagerSigner = await ethers.getSigner(releaseManager)
                const tx = await updateManager.connect(releaseManagerSigner).setAppCode(appId, myErc721.address)
                await tx.wait()
                const appAddress = await kernel.getAppAddress(appId)
                expect(appAddress).not.to.eq(myErc721.address)

                const codes = await updateManager.getAppCodeHistory(appId)
                expect(codes).to.contain(myErc721.address)
                expect(await kernel.hasPermission(releaseManager, kernel.address, 0)).to.eq(true)

                await expect(kernel.connect(releaseManagerSigner).upgradeApp(appId)).not.to.be.reverted
                const app: App = await ethers.getContractAt("App", await kernel.getAppAddress(AppsIds.ERC721))
                expect(await app.implementation()).to.eq(myErc721.address)
            })

            describe("when appId is random", () => {
                it("reverts", async () => {
                    const appId = ethers.utils.formatBytes32String("MyApp")
                    await expect(kernel.upgradeApp(appId)).to.be.reverted
                })
            })

            describe("when msg.sender is random address", () => {
                it("reverts", async () => {
                    const stranger = ethers.Wallet.createRandom()
                    const appId = ethers.utils.formatBytes32String("MockApp")
                    await expect(kernel.connect(stranger).upgradeApp(appId)).to.be.reverted
                })
            })
        })

        describe("#supportsInterface", () => {
            it("supports interface ERC-165", async () => {
                expect(await kernel.supportsInterface(InterfaceIds.IERC165)).to.be.true
            })

            it("supports interface IKernel", async () => {
                expect(await kernel.supportsInterface(InterfaceIds.IKernel)).to.be.true
            })
            it("not supports interface ERC-1155", async () => {
                expect(await kernel.supportsInterface(InterfaceIds.IERC1155)).to.be.false
            })
            it("supports interface IAppManager", async () => {
                expect(await kernel.supportsInterface(InterfaceIds.IAppManager)).to.be.true
            })
            it("supports interface IACL", async () => {
                expect(await kernel.supportsInterface(InterfaceIds.IACL)).to.be.true
            })
        })

        describe("#migrateToSafe", () => {
            it("creating a new safe", async () => {
                const oldTreasury = await kernel.getTreasury()
                await kernel.migrateTreasury()
                const newTreasury = await kernel.getTreasury()
                expect(newTreasury).not.to.be.equal(oldTreasury)
            })
        })
    })
})
