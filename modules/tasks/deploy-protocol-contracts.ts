import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import { ProtocolApps, protocolFactoryMapping } from "@constants//"
import "@nomiclabs/hardhat-ethers"

type UpgradeFromFileArgs = {
    ums: string
    apps: string
    noDeploy: boolean
}

task("deploy-protocol-contracts", "Unitily task (inteded for usage in other tasks) to deploy protocol contracts")
    .addOptionalParam("apps", "oneof ProtocolApps")
    .setAction(async (args: UpgradeFromFileArgs, hre: HardhatRuntimeEnvironment) => {
        const apps = args?.apps
            ? (args.apps.split(",").filter((val) => Object.keys(ProtocolApps).includes(val)) as Array<
                  keyof typeof ProtocolApps
              >)
            : (Object.keys(ProtocolApps) as Array<keyof typeof ProtocolApps>)

        for (const app of apps) {
            await hre.run("deploy", { tags: protocolFactoryMapping[app], write: true })
        }
    })
