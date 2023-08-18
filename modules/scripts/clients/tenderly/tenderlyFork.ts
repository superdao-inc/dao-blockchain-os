import { ForkABC } from "@utils/forkABC"
import { TenderlyAPI } from "./tenderlyAPI"
import * as dotenv from "dotenv"

dotenv.config()

const { TENDERLY_USERNAME, TENDERLY_PROJECT_ID, TENDERLY_ACCESS_KEY } = process.env
const tenderlyAPI = new TenderlyAPI(TENDERLY_ACCESS_KEY ?? "", TENDERLY_USERNAME ?? "", TENDERLY_PROJECT_ID ?? "")

export class TenderlyFork extends ForkABC {
    async create() {
        const { rpcUrl, accounts } = await tenderlyAPI.createFork(this.networkId, this.blockNumber)
        this.rpcUrl = rpcUrl
        this.accounts = accounts
    }

    async delete() {
        return await tenderlyAPI.deleteFork(this.rpcUrl)
    }
}
