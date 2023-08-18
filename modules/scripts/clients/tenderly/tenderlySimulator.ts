// Represents functionality of Tenderly simulator to play with a forked net and contracts within the one.
// Note:
// - Keep in mind that every account is automatically unlocked when performing simulations.
// This enables you to impersonate any address and send transactions.
// E.g:
// >> import { Contract } from "ethers";
// >> const erc20ContractExample = new Contract(address, abi);
// >> const unsignedTx = await erc20ContractExample.populateTransaction.approve(to, value)
// >> const transactionParameters = [{
//     to: erc20ContractExample.address,
//     from: ZERO_ADDRESS,
//     data: unsignedTx.data,
//     gas: ethers.utils.hexValue(3000000),
//     gasPrice: ethers.utils.hexValue(1),
//     value: ethers.utils.hexValue(0)
// }];
// >> const txHash = await TenderlySimulator(...).provider.send('eth_sendTransaction', transactionParameters)
// Ref to https://docs.tenderly.co/simulations-and-forks/simulation-api

import { SimulatorABC } from "../../../helpers/utils/simulatorABC"
import { formatWeiToRpcFormat } from "@utils/scripts/format"
import { UnsupportedMethod } from "@constants/errors"

export class TenderlySimulator extends SimulatorABC {
    async setBalance(to: string, value: string) {
        // console.log(`Set balance for ${to} on ${value} ...`)
        const params = [[to], formatWeiToRpcFormat(value)]
        return await this.provider.send("tenderly_setBalance", params)
    }

    impersonateAccount = (account: string) => {
        throw UnsupportedMethod
    }

    async createSnapshot() {
        return await this.provider.send("evm_snapshot", [])
    }

    async revertToSnapshot(snapshotId: string) {
        return await this.provider.send("evm_revert", [snapshotId])
    }
}
