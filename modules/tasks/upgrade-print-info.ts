import { task } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import "@nomiclabs/hardhat-ethers"
import { Signer, ethers } from "ethers"
import { readFileSync } from "fs"
import { AppsIds } from "@constants//"
import { keccak256 } from "ethers/lib/utils"

type UpgradeFromFileArgs = {
    file: string
}

const encodeAppId = (appId: string) => keccak256(ethers.utils.toUtf8Bytes(appId))

task("upgrade-print-info", "Upgrades a contracts implementation from file bypassing the UpdateManager")
    .addParam("file", "JSON file")
    .setAction(async (args: UpgradeFromFileArgs, hre: HardhatRuntimeEnvironment) => {
        const signers = await hre.ethers.getSigners()
        const { successTeam, releaseManager } = await hre.getNamedAccounts()
        const { file } = args
        // const signer: Signer = signers[0]
        const fileD = readFileSync(file, "utf-8")
        const json = JSON.parse(fileD)
        await printmode(json, hre, successTeam, releaseManager)
    })

async function printmode(json: any, hre: HardhatRuntimeEnvironment, successTeam: string, releaseManager: string) {
    const mihanix = "0x49753299f25CA4117226Ac680D8b4eB56864b431"
    const rm = releaseManager
    const elshan2 = "0x8Cc3019950D49FA5c0e5277c141a4BfD4858ca7f"
    const alexey = "0xF1888fF9B6841C5aAC50545430DC09E4Ad651780"
    const someone = "0x76c795173fd4031a464189E20669079710F06aF6"

    console.log(
        "entry.contractAddress" +
            "\t" +
            "isKernelContract" +
            "\t" +
            "hasPermissionMihanix" +
            "\t" +
            "hasPermissionRM" +
            "\t" +
            "hasPermissionElshan2" +
            "\t" +
            "hasPermissionSomeone" +
            "\t" +
            "hasPermissionAlexey" +
            "\t" +
            "hasPermissionGS" +
            "\t" +
            "updateManagerAdderess" +
            "\t" +
            "updateManagerOwner" +
            "\t" +
            "ERC721" +
            "\t" +
            "OpenSale" +
            "\t" +
            "WhiteList" +
            "\t" +
            "RM"
    )
    for (const entry of json) {
        if (entry.contractAddress === "" || entry.contractAddress === "0x") continue
        const kernel = await hre.ethers.getContractAt("Kernel", entry.contractAddress)
        let isKernelContract = false
        let updateManagerAdderess = "undefined"
        let hasPermissionMihanix
        let hasPermissionRM
        let hasPermissionElshan2
        let hasPermissionSomeone
        let hasPermissionGS
        let hasPermissionAlexey
        let updateManager
        let updateManagerOwner

        try {
            updateManagerAdderess = await kernel.getUpdateManager()
            isKernelContract = true
        } catch (e) {}
        if (isKernelContract) {
            try {
                hasPermissionMihanix = await kernel.hasPermission(mihanix, kernel.address, 0)
            } catch (e) {}
            try {
                hasPermissionRM = await kernel.hasPermission(rm, kernel.address, 0)
            } catch (e) {}
            try {
                hasPermissionElshan2 = await kernel.hasPermission(elshan2, kernel.address, 0)
            } catch (e) {}
            try {
                hasPermissionSomeone = await kernel.hasPermission(someone, kernel.address, 0)
            } catch (e) {}
            try {
                hasPermissionGS = await kernel.hasPermission(successTeam, kernel.address, 0)
            } catch (e) {}
            try {
                hasPermissionAlexey = await kernel.hasPermission(alexey, kernel.address, 0)
            } catch (e) {}

            try {
                updateManager = await hre.ethers.getContractAt("UpdateManager", updateManagerAdderess)
                updateManagerOwner = await updateManager.owner()
            } catch (e) {}
        }
        const isErc721 =
            isKernelContract === false
                ? false
                : (await kernel.getAppAddress(encodeAppId(AppsIds.ERC721))) !==
                  "0x0000000000000000000000000000000000000000"
        const isOpen =
            isKernelContract === false
                ? false
                : (await kernel.getAppAddress(encodeAppId(AppsIds.ERC721_OPEN_SALE))) !==
                  "0x0000000000000000000000000000000000000000"
        const isWhitelist =
            isKernelContract === false
                ? false
                : (await kernel.getAppAddress(encodeAppId(AppsIds.ERC721_WHITELIST_SALE))) !==
                  "0x0000000000000000000000000000000000000000"
        const isRM =
            isKernelContract === false
                ? false
                : (await kernel.getAppAddress(encodeAppId(AppsIds.RELEASE_MANAGER))) !==
                  "0x0000000000000000000000000000000000000000"

        console.log(
            entry.contractAddress +
                "\t" +
                isKernelContract +
                "\t" +
                hasPermissionMihanix +
                "\t" +
                hasPermissionRM +
                "\t" +
                hasPermissionElshan2 +
                "\t" +
                hasPermissionSomeone +
                "\t" +
                hasPermissionAlexey +
                "\t" +
                hasPermissionGS +
                "\t" +
                updateManagerAdderess +
                "\t" +
                (updateManagerOwner === mihanix
                    ? "mihanix"
                    : updateManagerOwner === rm
                    ? "rm"
                    : updateManagerOwner === elshan2
                    ? "elshan2"
                    : updateManagerOwner === someone
                    ? "someone"
                    : updateManagerOwner === alexey
                    ? "alexey"
                    : updateManagerOwner) +
                "\t" +
                isErc721 +
                "\t" +
                isOpen +
                "\t" +
                isWhitelist +
                "\t" +
                isRM
        )
    }
}
