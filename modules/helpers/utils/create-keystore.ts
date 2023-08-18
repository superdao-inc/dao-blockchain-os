import keythereum from "keythereum"
import web3Utils from "web3-utils"

// @ts-ignore
const generateKeystore = async (privateKey, password, count = 131072) => {
    const modPrivateKey = web3Utils.stripHexPrefix(privateKey)

    const params = { keyBytes: 32, ivBytes: 16 }
    const dk = keythereum.create(params)

    const options = {
        kdf: "scrypt",
        cipher: "aes-128-ctr",
        kdfparams: { dklen: 32, n: +count, r: 8, p: 1 },
    }

    return await new Promise((resolve) => {
        // @ts-ignore
        keythereum.dump(password, modPrivateKey, dk.salt, dk.iv, options, (keyObject) => {
            const name = `UTC--${new Date().toISOString().replace(/[:]/g, "-")}--${keyObject.address}`

            const jsonContent = keythereum.exportToFile(keyObject, "./keystore")

            resolve([name, jsonContent])
            console.log(`keyObject with address - 0x${keyObject.address}, was stored in dir keystore`)
        })
    })
}

generateKeystore(process.argv[2], process.argv[3])
