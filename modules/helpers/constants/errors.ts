export class UnsupportedMethod extends Error {
    constructor(message?: string) {
        super(message)
        this.name = "UnsupportedMethod"
        Object.setPrototypeOf(this, new.target.prototype) // restore prototype chain
    }
}
