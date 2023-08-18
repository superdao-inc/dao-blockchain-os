import { SimulatorABC } from "@utils/simulatorABC"
import { formatWeiToRpcFormat } from "@utils/scripts/format"

export class HardhatSimulator extends SimulatorABC {
    async impersonateAccount(account: string) {
        return await this.provider.send("hardhat_impersonateAccount", [account])
    }

    async setBalance(to: string, value: string): Promise<any> {
        // console.log(`Set balance for ${to} on ${value} ...`)
        return await this.provider.send("hardhat_setBalance", [to, formatWeiToRpcFormat(value)])
    }

    async createSnapshot(): Promise<string> {
        return await this.provider.send("evm_snapshot", [])
    }

    async revertToSnapshot(snapshotId: string): Promise<any> {
        // todo: snapshot could be used only once (add check otherwise it is fail silence method)
        return this.provider.send("evm_revert", [snapshotId])
    }
}
