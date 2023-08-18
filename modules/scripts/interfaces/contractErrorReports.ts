interface ContractErrorReport {
    contractAddress: string
    message: any
}

export type ContractErrorReports = Array<ContractErrorReport>
