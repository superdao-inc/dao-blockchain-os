// Convenience fork creation example
// To run:
// fill env with tenderly envs and start:
// >> ts-node scripts/tenderly/create-fork.ts
import { TenderlyAPI } from "../clients/tenderly/tenderlyAPI"
import * as dotenv from "dotenv"

dotenv.config()

const { TENDERLY_USERNAME, TENDERLY_PROJECT_ID, TENDERLY_ACCESS_KEY } = process.env

async function main() {
    const api = new TenderlyAPI(TENDERLY_ACCESS_KEY ?? "", TENDERLY_USERNAME ?? "", TENDERLY_PROJECT_ID ?? "")
    const createdFork = await api.createFork("137", 30295651)
    console.log("Created fork rpc for polygon mainnet", createdFork.rpcUrl)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
