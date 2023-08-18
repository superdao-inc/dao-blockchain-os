import { expect } from "chai"
import { ethers, getNamedAccounts } from "hardhat"
import { AppsIds } from "@utils/const"
import { deploymentFixture } from "@utils/hardhat"
import { encodeAppId } from "@utils//"
import { UpdateManager } from "@typechain-types/UpdateManager"
import { CallForwarder } from "@typechain-types/CallForwarder"
import { Exceptions } from "@constants/exceptions"

describe("ERC721WhitelistClaim [app]", () => {
    let fixture: () => Promise<void>
    let updateManager: UpdateManager
    let callForwarder: CallForwarder
    before(async () => {
        fixture = async () => {
            const fixtureFunction = deploymentFixture({})
            const { releaseManager } = await getNamedAccounts()
            const releaseManagerSigner = await ethers.getSigner(releaseManager)
            const { updateManager: fupdateManager, callForwarder: fcallForwarder } = await fixtureFunction()
            updateManager = fupdateManager.connect(releaseManagerSigner)
            callForwarder = fcallForwarder
        }
    })

    beforeEach(async () => {
        await fixture()
    })

    describe("#deployBeaconById", () => {
        it("Should not deploy if beacon already exists", async () => {
            const appId = AppsIds.ADMIN_CONTROLLER
            await expect(updateManager.deployBeaconById(appId)).to.be.revertedWith(Exceptions.VALIDATION_ERROR)
        })

        it("Should not deploy if implementation is zero address", async () => {
            const appId = encodeAppId("newApp")
            const impl = ethers.constants.AddressZero
            await updateManager.setAppCode(appId, impl)

            await expect(updateManager.deployBeaconById(appId)).to.be.revertedWith(Exceptions.ADDRESS_IS_NOT_CONTRACT)
        })

        it("Should not deploy if implementation is not a contract", async () => {
            const appId = encodeAppId("newApp")
            const impl = ethers.Wallet.createRandom()
            await updateManager.setAppCode(appId, impl.address)

            await expect(updateManager.deployBeaconById(appId)).to.be.revertedWith(Exceptions.ADDRESS_IS_NOT_CONTRACT)
        })

        it("Should not deploy a new beacon if caller is not the owner", async () => {
            const hacker = (await ethers.getSigners())[4]
            const appId = encodeAppId("newApp")
            const impl = await (await ethers.getContractFactory("MockApp")).deploy(callForwarder.address)
            await updateManager.setAppCode(appId, impl.address)
            await expect(updateManager.connect(hacker).deployBeaconById(appId)).to.be.revertedWith(
                Exceptions.CALLER_IS_NOT_OWNER
            )
        })

        it("Should deploy a new beacon by Id", async () => {
            const appId = encodeAppId("newApp")
            const impl = await (await ethers.getContractFactory("MockApp")).deploy(callForwarder.address)
            await updateManager.setAppCode(appId, impl.address)
            await updateManager.deployBeaconById(appId)
            const beacon = await updateManager.getBeacon(appId)
            expect(beacon).to.be.not.equal(ethers.constants.AddressZero)
        })
    })

    describe("#deployBeacon", () => {
        it("Should not deploy if beacon already exists", async () => {
            const appId = AppsIds.ADMIN_CONTROLLER
            const impl = await (await ethers.getContractFactory("MockApp")).deploy(callForwarder.address)
            await expect(updateManager.deployBeacon(appId, impl.address)).to.be.revertedWith(
                Exceptions.VALIDATION_ERROR
            )
        })

        it("Should not deploy if implementation is zero address", async () => {
            const appId = encodeAppId("newApp")
            const impl = ethers.constants.AddressZero
            await updateManager.setAppCode(appId, impl)

            await expect(updateManager.deployBeacon(appId, impl)).to.be.revertedWith(Exceptions.ADDRESS_IS_NOT_CONTRACT)
        })

        it("Should not deploy if implementation is not a contract", async () => {
            const appId = encodeAppId("newApp")
            const impl = ethers.Wallet.createRandom()
            await updateManager.setAppCode(appId, impl.address)

            await expect(updateManager.deployBeacon(appId, impl.address)).to.be.revertedWith(
                Exceptions.ADDRESS_IS_NOT_CONTRACT
            )
        })

        it("Should not deploy a new beacon if caller is not the owner", async () => {
            const hacker = (await ethers.getSigners())[4]
            const appId = encodeAppId("newApp")
            const impl = await (await ethers.getContractFactory("MockApp")).deploy(callForwarder.address)
            await expect(updateManager.connect(hacker).deployBeacon(appId, impl.address)).to.be.revertedWith(
                Exceptions.CALLER_IS_NOT_OWNER
            )
        })

        it("Should deploy a new beacon", async () => {
            const appId = encodeAppId("newApp")
            const impl = await (await ethers.getContractFactory("MockApp")).deploy(callForwarder.address)
            await updateManager.deployBeacon(appId, impl.address)
            const beacon = await updateManager.getBeacon(appId)
            expect(beacon).to.be.not.equal(ethers.constants.AddressZero)
        })
    })

    describe("#Updatebeacon", () => {
        it("Should not update beacon if new impl is zero", async () => {
            const appId = encodeAppId("newApp")
            const impl = ethers.constants.AddressZero
            await expect(updateManager.updateBeacon(appId, impl)).to.be.revertedWith(Exceptions.VALIDATION_ERROR)
        })

        it("Should not update beacon if new impl is not a contract", async () => {
            const appId = encodeAppId("newApp")
            const impl = ethers.Wallet.createRandom()
            await expect(updateManager.updateBeacon(appId, impl.address)).to.be.revertedWith(
                Exceptions.VALIDATION_ERROR
            )
        })

        it("Should not update beacon if caller is not the owner", async () => {
            const hacker = (await ethers.getSigners())[4]
            const appId = AppsIds.ADMIN_CONTROLLER

            const impl = await (await ethers.getContractFactory("AdminController")).deploy(callForwarder.address)

            await expect(updateManager.connect(hacker).updateBeacon(appId, impl.address)).to.be.revertedWith(
                Exceptions.CALLER_IS_NOT_OWNER
            )
        })

        it("Should update beacon", async () => {
            const appId = AppsIds.ADMIN_CONTROLLER
            const prevImpl = await updateManager.getImplementation(appId)

            const impl = await (await ethers.getContractFactory("AdminController")).deploy(callForwarder.address)

            await updateManager.updateBeacon(appId, impl.address)
            const newImpl = await updateManager.getImplementation(appId)

            expect(newImpl).to.be.not.equal(prevImpl)
            expect(newImpl).to.be.equal(impl.address)
        })
    })
})
