import { expect } from "chai"
import { ethers } from "hardhat"
import { buildRequest, ERC721PropertiesCallData, MockAppCallData } from "@utils/call-forwarder-helper"
import { parseEther } from "ethers/lib/utils"
import { MockApp, Kernel, CallForwarder } from "@typechain-types//"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { deploymentFixture } from "@utils/hardhat"
import { AppsIds } from "@utils/const"

describe.skip("Call Forwarder", async () => {
    let signer: SignerWithAddress

    let app: MockApp
    let callForwarder: CallForwarder
    let kernel: Kernel
    let CHAIN_ID = 31337

    beforeEach(async () => {
        const accounts = await ethers.getSigners()
        signer = accounts[3]
        const fixtureFunction = deploymentFixture({})

        const { kernel: fkernel, app: fapp, callForwarder: _callForwarder } = await fixtureFunction()

        kernel = fkernel
        app = fapp
        callForwarder = _callForwarder

        const appId = AppsIds.MOCKAPP
        const userId = ethers.utils.formatBytes32String("user")
        await kernel.connectApp(userId, signer.address, false)
        await kernel.addPermission(userId, appId, 0)
        await expect(app.connect(signer).testRequireSUDO()).not.to.be.reverted
        const network = await ethers.provider.getNetwork()
        CHAIN_ID = network.chainId
    })

    it.skip("Check signature", async () => {
        const callData = ERC721PropertiesCallData.encodeFunctionData("transferFrom", [
            "0x1234567890123456789012345678901234567890",
            "0x1234567890123456789012345678901234567890",
            parseEther("1.0"),
        ])
        const forwardRequest: any = buildRequest(
            signer.address,
            "0x1234567890123456789012345678901234567890",
            0,
            Number((await callForwarder.getNonce(signer.address))._hex),
            callData,
            callForwarder.address,
            CHAIN_ID
        )

        const signature = await signer._signTypedData(
            forwardRequest.domain,
            forwardRequest.types,
            forwardRequest.message
        )

        expect(await callForwarder.verify(forwardRequest.message, signature)).to.equal(true)
        forwardRequest.message.nonce++
        expect(await callForwarder.verify(forwardRequest.message, signature)).to.equal(false)
    })

    it.skip("Check single executing without signature", async () => {
        const callData = MockAppCallData.encodeFunctionData("testRequireSUDO")
        const nonce = Number((await callForwarder.getNonce(signer.address))._hex)
        const forwardRequest = buildRequest(
            signer.address,
            app.address,
            0,
            nonce,
            callData,
            callForwarder.address,
            CHAIN_ID
        )
        await expect(app.testRequireSUDO()).to.be.reverted
        await expect(callForwarder["executeSingle((address,address,uint256,uint256,bytes))"](forwardRequest.message)).to
            .be.reverted

        await expect(app.connect(signer).testRequireSUDO()).not.to.be.reverted
        await expect(
            callForwarder
                .connect(signer)
                ["executeSingle((address,address,uint256,uint256,bytes))"](forwardRequest.message)
        ).not.to.be.reverted
    })

    it.skip("Check batch executing without signature", async () => {
        const TRX_COUNT = 10
        const callData = MockAppCallData.encodeFunctionData("testRequireSUDO")
        const chainId = CHAIN_ID
        const forwardRequests = []
        for (let i = 0; i < TRX_COUNT; i++) {
            const nonce = Number((await callForwarder.getNonce(signer.address))._hex)
            forwardRequests.push(
                buildRequest(signer.address, app.address, 0, nonce, callData, callForwarder.address, chainId).message
            )
        }

        await expect(
            callForwarder.connect(signer)["executeBatch((address,address,uint256,uint256,bytes)[])"](forwardRequests)
        ).not.to.be.reverted
    })

    it.skip("Verify", async () => {
        const callData = MockAppCallData.encodeFunctionData("testRequireSUDO")
        const nonce = Number((await callForwarder.getNonce(signer.address))._hex)
        const forwardRequest = buildRequest(
            signer.address,
            app.address,
            0,
            nonce,
            callData,
            callForwarder.address,
            CHAIN_ID
        )

        const signature = await signer._signTypedData(
            forwardRequest.domain,
            forwardRequest.types,
            forwardRequest.message
        )

        expect(await callForwarder.verify(forwardRequest.message, signature)).to.equal(true)
    })

    it.skip("Check single executing with signature", async () => {
        const callData = MockAppCallData.encodeFunctionData("testRequireSUDO")
        const nonce = Number((await callForwarder.getNonce(signer.address))._hex)
        const forwardRequest = buildRequest(
            signer.address,
            app.address,
            0,
            nonce,
            callData,
            callForwarder.address,
            CHAIN_ID
        )

        const signature = await signer._signTypedData(
            forwardRequest.domain,
            forwardRequest.types,
            forwardRequest.message
        )

        await expect(app.testRequireSUDO()).to.be.reverted
        await expect(callForwarder["executeSingle((address,address,uint256,uint256,bytes))"](forwardRequest.message)).to
            .be.reverted

        await expect(app.connect(signer).testRequireSUDO()).not.to.be.reverted

        const fakeMessage = JSON.parse(JSON.stringify(forwardRequest.message))
        fakeMessage.value++

        await expect(
            callForwarder["executeSingle((address,address,uint256,uint256,bytes),bytes)"](fakeMessage, signature)
        ).to.be.reverted

        expect(await callForwarder.verify(forwardRequest.message, signature)).to.equal(true)

        await expect(
            callForwarder["executeSingle((address,address,uint256,uint256,bytes),bytes)"](
                forwardRequest.message,
                signature
            )
        ).not.to.be.reverted

        await expect(
            callForwarder["executeSingle((address,address,uint256,uint256,bytes),bytes)"](
                forwardRequest.message,
                signature
            )
        ).to.be.reverted
    })

    it.skip("Check batch executing with signature", async () => {
        const TRX_COUNT = 5
        const accounts = await ethers.getSigners()
        const callData = MockAppCallData.encodeFunctionData("testRequireSUDO")
        const chainId = CHAIN_ID
        const forwardRequests = []
        const signatures = []
        const appId = AppsIds.MOCKAPP
        for (let i = 0; i < TRX_COUNT; i++) {
            const user = accounts[5 + i]
            const userId = ethers.utils.formatBytes32String(`account ${i}`)

            await kernel.connectApp(userId, user.address, false)
            await kernel.addPermission(userId, appId, 0)

            const nonce = Number((await callForwarder.getNonce(user.address))._hex)
            const forwardRequest = buildRequest(
                user.address,
                app.address,
                0,
                nonce,
                callData,
                callForwarder.address,
                chainId
            )
            forwardRequests.push(forwardRequest.message)
            signatures.push(
                await user._signTypedData(forwardRequest.domain, forwardRequest.types, forwardRequest.message)
            )
        }
        await expect(
            callForwarder["executeBatch((address,address,uint256,uint256,bytes)[],bytes[])"](
                forwardRequests,
                signatures
            )
        ).not.to.be.reverted

        for (let i = 0; i < TRX_COUNT; i++) {
            const user = accounts[10 + i]

            const nonce = Number((await callForwarder.getNonce(user.address))._hex)
            const forwardRequest = buildRequest(
                user.address,
                app.address,
                0,
                nonce,
                callData,
                callForwarder.address,
                chainId
            )
            forwardRequests.push(forwardRequest.message)
            signatures.push(
                await user._signTypedData(forwardRequest.domain, forwardRequest.types, forwardRequest.message)
            )
        }
        await expect(
            callForwarder["executeBatch((address,address,uint256,uint256,bytes)[],bytes[])"](
                forwardRequests,
                signatures
            )
        ).to.be.reverted
    })
})
