// Represents methods of Tenderly API Gateway.
// Note:
// - tenderly is a project base service, thus, to start work with anything,
// create an appropriate project.
// - some tenderly api features may be used under the hood of hardhat
// but not all, that is my this class exists.
// Requirements:
// - axios
// Ref to https://docs.tenderly.co/simulations-and-forks/simulation-api

// todo: declare response from tenderly api in interface? manner to proceed api resp. validation
import axios, { AxiosInstance } from "axios"

export const tenderlyAxiosGateway = (AccessKey: string, version: string) =>
    axios.create({
        baseURL: "https://api.tenderly.co/api/" + version,
        headers: {
            "X-Access-Key": AccessKey,
            "Content-Type": "application/json" as string,
        },
    })

interface CreatedFork {
    rpcUrl: string
    accounts: { [key: string]: string }
}

export class TenderlyAPI {
    public access_key: string
    public version: string
    public user_name: string
    public project_id: string
    private _axiosGateway: AxiosInstance
    private _forkRpcUrlToUrl: Map<string, string>

    constructor(AccessKey: string, UserName: string, ProjectId: string, version = "v1") {
        this.access_key = AccessKey
        this.version = version
        this.user_name = UserName
        this.project_id = ProjectId
        this._axiosGateway = tenderlyAxiosGateway(this.access_key, this.version)
        this._forkRpcUrlToUrl = new Map()
    }

    async createFork(networkId: string, blockNumber?: number): Promise<CreatedFork> {
        console.log(`Create fork for networkId ${networkId} ...`)
        const url = `account/${this.user_name}/project/${this.project_id}/fork`
        const resp = await this._axiosGateway.post(url, {
            network_id: networkId,
            block_number: blockNumber,
        })
        const forkUrl = `https://rpc.tenderly.co/fork/${resp.data.simulation_fork.id}`
        const forkAccounts = resp.data.simulation_fork.accounts
        console.log("Created fork with tenderly on url:", forkUrl)
        this._forkRpcUrlToUrl.set(forkUrl, url)
        return { rpcUrl: forkUrl, accounts: forkAccounts }
    }

    async deleteFork(forkUrl: string) {
        const forkId = forkUrl.split("/").pop()
        console.log(`Try to delete fork with id: ${forkId} ...`)
        const url = (this._forkRpcUrlToUrl.get(forkUrl) as string) + "/" + forkId
        // todo: no schema response in tenderly api =(
        // todo: can not transact
        await this._axiosGateway.delete(url)
        return this._forkRpcUrlToUrl.delete(forkUrl)
    }
}
