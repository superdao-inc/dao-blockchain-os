export type AsyncRuntime = (func: () => Promise<void>) => void

export const asyncRuntime: AsyncRuntime = (func) => {
    func()
        .then(() => process.exit(0))
        .catch((error: any) => {
            console.error(error)
            process.exit(1)
        })
}
