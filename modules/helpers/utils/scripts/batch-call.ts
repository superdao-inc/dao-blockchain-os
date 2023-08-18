import "hardhat-deploy/dist/src/type-extensions"
import { Contract } from "ethers"
import { Engine } from "@scripts/interfaces/engine"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { DOMAIN, VERSION } from "@constants/appsIds"
import { promises } from "fs"
import { logEngine } from "./migrate"
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
    contractAddress?: string,
    logger?: any
): Promise<BatchCallReturn> {
    // console.log('got into batchcall')
    if (contracts.length !== data.length) {
        throw new Error("contracts.length must be equals with data.length")
    }

    const callForwarderAddr = !contractAddress
        ? (await engine.deployments.get("CallForwarder")).address
        : contractAddress

    // const callForwarderAddr = (await engine.deployments.get("CallForwarder")).address

    logEngine(loggerLog(`callForwarder address ${callForwarderAddr}`), logger)
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
            logEngine(loggerLog("with gasLimit"), logger)
            tx = await callForwarder["executeBatch((address,address,uint256,uint256,bytes)[])"](requests, { gasLimit })
        } else {
            logEngine(loggerLog("without gasLimit"), logger)
            tx = await callForwarder["executeBatch((address,address,uint256,uint256,bytes)[])"](requests)
        }
        // cant use logEngine here, progress bar overwrites the log when the script is ending
        console.log(tx.hash)
        await tx.wait(1)
        console.log("Success\n")
        logEngine(loggerLog(`${requests.length} txs fullfilled`), logger)

        return { success: true }
    } catch (e) {
        console.log(`tx failed`)
        logEngine(loggerLog(`writing to modules/tasks/reports/errors.tx-batch.long-report.json`), logger)
        logEngine(loggerLog(""), logger)

        // proper error report for bad kernel aggregation
        if (batchSize) {
            const path = "./modules/tasks/reports/errors.tx-batch.long-report.json"
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
