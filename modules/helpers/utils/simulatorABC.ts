import { ethers } from "ethers"

interface RpcProvider {
    rpcProvider: any
    rpc?: string
}

interface Rpc {
    rpcProvider?: any
    rpc: string
}

type RpcProviderOrRpc = Rpc | RpcProvider

export abstract class SimulatorABC {
    public provider: ethers.providers.JsonRpcProvider

    constructor(rpcProviderOrRpc: RpcProviderOrRpc) {
        if (rpcProviderOrRpc.rpc) {
            this.provider = new ethers.providers.JsonRpcProvider(rpcProviderOrRpc.rpc)
        } else {
            this.provider = rpcProviderOrRpc.rpcProvider
        }
    }

    abstract setBalance(to: string, value: string): Promise<any>
    abstract impersonateAccount(account: string): Promise<any>
    abstract createSnapshot(): Promise<string>
    abstract revertToSnapshot(snapshotId: string): Promise<any>
    // todo: make sendTransaction to be ABC
}
