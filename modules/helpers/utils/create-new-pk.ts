import keythereum from "keythereum"

// @ts-ignore
const createKeyObject = (password) => {
    // TODO
    // @ts-ignore
    const dk = keythereum.create()
    const keyObject = keythereum.dump(password, dk.privateKey, dk.salt, dk.iv)
    keythereum.exportToFile(keyObject, "./keystore")
    console.log(`keyObject with address - 0x${keyObject.address}, was stored in dir keystore`)
}

createKeyObject(process.argv[2])
