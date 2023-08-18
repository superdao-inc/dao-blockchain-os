import { ethers } from "hardhat"
import { asyncRuntime } from "@utils/scripts/asyncRuntime"
import { Kernel } from "@typechain-types/Kernel"
import inquirer from "inquirer"
import cliProgress from "cli-progress"
import fs from "fs"
import path from "path"
import { AppsIds } from "@constants/appsIds"
import { encodeAppId } from "@utils/econdeAppId"

async function main() {
    const daos = [{ contractAddress: "0x0" }]

    const checkAddress = await inquirer.prompt([
        {
            type: "input",
            name: "hex",
            message: "Please input the address",
            validate(input) {
                return ethers.utils.isAddress(input)
            },
        },
    ])

    const appsToCheck = await inquirer.prompt([
        {
            type: "checkbox",
            name: "apps",
            message: "Choose the apps to check",
            choices: Object.keys(AppsIds),
            default: [AppsIds.KERNEL], // KERNEL
        },
    ])

    let appsUnderControl = 0
    let counter = 0
    console.log(`checking ${daos.length} DAOs...`)

    const multibar = new cliProgress.MultiBar(
        {
            clearOnComplete: false,
            hideCursor: true,
        },
        cliProgress.Presets.shades_grey
    )

    const makeBar = (title: string, address = true, app = true, eta = true) =>
        `${title} [{bar}] {percentage}% |${address ? " {address} |" : ""}${app ? " {app} |" : ""}${
            eta ? " ETA: {eta}s |" : ""
        } {value}/{total}`

    const adminBar = multibar.create(
        daos.length * appsToCheck.apps.length,
        0,
        {},
        { format: makeBar("admin-of ", true, true, false) }
    )
    const totalBar = multibar.create(daos.length, 0, {}, { format: makeBar("checked  ", true, false) })

    const adminOf: { [key: string]: any } = {
        address: checkAddress.hex,
    }

    appsToCheck.apps.forEach((app: keyof typeof AppsIds) => {
        adminOf[app] = []
    })

    for (const dao of daos) {
        try {
            totalBar.update(counter, { address: dao.contractAddress })
            totalBar.increment()
            counter++

            for (const app of appsToCheck.apps as Array<keyof typeof AppsIds>) {
                try {
                    const kernel: Kernel = await ethers.getContractAt("Kernel", dao.contractAddress)
                    const appAddress = await kernel.getAppAddress(encodeAppId(app))
                    adminBar.update(appsUnderControl, { app, address: appAddress })
                    const isAdmin = await kernel.hasPermission(checkAddress.hex, appAddress, 0)

                    if (isAdmin) {
                        appsUnderControl++
                        adminOf[app].push(dao)
                        adminBar.increment()
                    }
                } catch (error) {}
            }
        } catch (error) {}
    }
    multibar.stop()

    console.log(`\n${checkAddress.hex} is the admin of ${appsUnderControl} apps`)

    if (appsUnderControl > 0) {
        const filePath = path.join(__dirname, "output", "checked-daos-admin.json")
        await fs.promises.writeFile(filePath, JSON.stringify(adminOf, null, 4))

        console.log(`${filePath} written`)
    }
}

asyncRuntime(main)
