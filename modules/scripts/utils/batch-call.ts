import "hardhat-deploy/dist/src/type-extensions"
import { Contract } from "ethers"
import { Engine } from "../interfaces/engine"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { DOMAIN, VERSION } from "@constants//"
import { promises } from "fs"
import { logEngine } from "@utils/scripts/migrate"
import { loggerLog } from "@scripts/core/upgrade-apps-impls-batch"

export type BatchCallReturn = {
    success: boolean
    errorMessage?: any
}

export async function batchCall(
    signer: SignerWithAddress,
    engine: Engine,
    contracts: Array<Contract>,
    data: Array<string>,
    gasLimit?: number,
    batchSize?: number,
    logger?: any
): Promise<BatchCallReturn> {
    if (contracts.length !== data.length) {
        throw new Error("contracts.length must be equals with data.length")
    }

    const callForwarderAddr = (await engine.deployments.get("CallForwarder")).address
    const callForwarderUnsigned = await engine.hreEthers.getContractAt("CallForwarder", callForwarderAddr)
    const callForwarder = callForwarderUnsigned.connect(signer)
    const requests: any[] = []
    const { chainId } = await engine.hreEthers.provider.getNetwork()
    const nonce = await callForwarder.getNonce(signer.address)
    logEngine(loggerLog("building requests..."), logger)
    for (let i = 0; i < contracts.length; i++) {
        requests.push(
            buildRequest(signer.address, contracts[i].address, 0, nonce, data[i], callForwarderAddr, chainId).message
        )
    }

    try {
        logEngine(loggerLog(`pending ${requests.length} tx...`), logger)
        let tx
        if (gasLimit) {
            logEngine(loggerLog("with gasLimit\n"), logger)
            tx = await callForwarder["executeBatch((address,address,uint256,uint256,bytes)[])"](requests, { gasLimit })
        } else {
            logEngine(loggerLog("without gasLimit\n"), logger)
            tx = await callForwarder["executeBatch((address,address,uint256,uint256,bytes)[])"](requests)
        }
        logEngine(loggerLog(tx.hash), logger)
        await tx.wait(1)
        logEngine(loggerLog("Success"), logger)

        return { success: true }
    } catch (e) {
        logEngine(loggerLog(`tx failed`), logger)

        // proper error report for bad kernel aggregation
        if (batchSize) {
            const path = "./tasks/reports/errors.tx-batch.long-report.json"
            let errors = []

            try {
                errors = JSON.parse(await promises.readFile(path, { encoding: "utf-8" }))
            } catch (error) {}

            await promises.writeFile(
                path,
                JSON.stringify(
                    [...errors, { contracts: contracts.map((el) => el.address), req: requests[0], error: e }],
                    null,
                    4
                )
            )
        }
        await promises.writeFile("./tasks/reports/errors.tx-batch-error.json", JSON.stringify(e, null, 4))

        return { success: false, errorMessage: e }
    }
}
const ForwardRequest = [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "data", type: "bytes" },
]

const buildRequest = (
    from: string,
    to: string,
    value: any,
    nonce: number,
    data: string,
    verifyingContract: string,
    chainId: number
) => ({
    primaryType: "ForwardRequest",
    types: { ForwardRequest },
    domain: { name: DOMAIN, version: VERSION, chainId, verifyingContract },
    message: { from, to, value, nonce, data },
})
