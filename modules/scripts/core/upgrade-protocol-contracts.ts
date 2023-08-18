import { AppsIds, ProtocolApps } from "@constants/appsIds"
import { protocolFactoryMapping } from "@constants/mappings"
import { ChainIds } from "@constants/networks"
import { HardhatSimulator } from "@scripts/clients/hardhat/hardhatSimulator"
import { Engine } from "@scripts/interfaces/engine"
import { getContract } from "@utils/scripts/getContract"
import { ethers } from "ethers"

export type ProtocolApp = {
    contractAddress: string
    app: keyof typeof ProtocolApps
}

type ErrorsLog = { contractAddress: string; error: any }

export const upgradeProtocolContracts = async (
    apps: ProtocolApp[],
    signerAddress: string,
    engine: Engine,
    raiseOnError = false
): Promise<ErrorsLog[]> => {
    let totalErrors: ErrorsLog[] = []

    for (const app of apps) {
        if (app.contractAddress === "" || app.contractAddress === "0x") continue

        console.log(`Upgrading app ${app.app} with address: ${app.contractAddress}`)
        const errors = await upgradeProtocolContract(app.app, app.contractAddress, signerAddress, engine, raiseOnError)

        if (errors.length > 0) {
            totalErrors = [...totalErrors, ...errors]
        }
    }

    return totalErrors
}

export const upgradeProtocolContract = async (
    app: keyof typeof ProtocolApps,
    contractAddress: string,
    signerAddress: string,
    engine: Engine,
    raiseOnError: boolean
): Promise<ErrorsLog[]> => {
    const errors: ErrorsLog[] = []

    if (engine?.hreEthers) {
        // signerAddress should be impersonated or passed to hardhat directly through private
        // if we work on mainnet
        const { chainId } = await engine.hreEthers.provider.getNetwork()
        if (chainId === Number(ChainIds.hardhat)) {
            console.log(`In hardhat node impersonated account ${signerAddress} will be used...`)
            const simulatorHardhat: HardhatSimulator = new HardhatSimulator({ rpcProvider: engine.hreEthers.provider })
            await simulatorHardhat.impersonateAccount(signerAddress)
        }

        const contractUnsigned = await getContract(engine, contractAddress, protocolFactoryMapping[app])
        const signer = await engine.hreEthers.getSigner(signerAddress)
        const contract = contractUnsigned.connect(signer)

        try {
            const owner = await contract.owner()
            console.log("owner: " + owner)
        } catch (error) {}

        const newImplAddress = (await engine.deployments.get(protocolFactoryMapping[app])).address

        try {
            console.log("Checking if the app is already updated:")
            const currentImplAddress = await contract.implementation()

            if (currentImplAddress === newImplAddress) {
                console.log(`${app} at ${contractAddress} is already on the latest deployment`)
                return errors
            }
        } catch (error) {
            console.log("Contract doesnt support implementation() method, skipping the check...")
        }

        try {
            console.log(`Upgrading app ${app}...`)
            const tx = await contract.upgrade(newImplAddress)
            await tx.wait(1)
            console.log("App upgraded successfully")

            return errors
        } catch (error: any) {
            console.log("Error encountered, shutting down...")
            errors.push({
                contractAddress: contract.address,
                error,
            })
            if (raiseOnError) {
                throw new Error(error)
            }

            return errors
        }
    }

    const contract = await getContract(engine, contractAddress, protocolFactoryMapping[app])
    const newImplAddress = (await engine.deployments.get(protocolFactoryMapping[app])).address
    const unsignedTx = await contract.populateTransaction.upgrade(newImplAddress) // todo: only if tenderly
    const transactionParameters = [
        {
            to: contract.address,
            from: signerAddress,
            data: unsignedTx.data,
            gas: ethers.utils.hexValue(3000000),
            gasPrice: ethers.utils.hexValue(1),
            save: true,
        },
    ]

    await engine.simulator!.provider.send("eth_sendTransaction", transactionParameters)
    return errors
}
