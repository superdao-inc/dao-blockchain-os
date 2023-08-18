export abstract class ForkABC {
    public networkId: string
    public blockNumber?: number
    public accounts: { [key: string]: string }
    public rpcUrl: string

    constructor(networkId: string, blockNumber?: number) {
        this.networkId = networkId
        this.blockNumber = blockNumber
        this.accounts = {}
        this.rpcUrl = ""
    }

    abstract create(): Promise<any> // todo: create only once
    abstract delete(): Promise<any>
}
