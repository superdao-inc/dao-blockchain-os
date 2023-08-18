import axios from "axios"
import { polygonSubgraph, stageSubgraph, superdaoMainnet, superdaoStage } from "@constants/endpoints"
import { auth } from "@constants/cookies"
import { ContractJSON } from "@utils/scripts/filterKernels"
import { Environment } from "@scripts/interfaces/environment"

export const getKernelsTheGraph = async (env: Environment, batchSize: number) => {
    if (batchSize <= 0) {
        throw new Error("BatchSize should be a positive number")
    }

    let skip = 0
    const makeQuery = (first: number, skip: number) => ({
        query: `{
            daos(first: ${first}, skip: ${skip}) {
                id
            }
        }`,
    })

    let finishedFetching = false
    let kernels: ContractJSON[] = []

    const endpoint = env === Environment.MAINNET ? polygonSubgraph : stageSubgraph

    while (!finishedFetching) {
        try {
            const response = await axios.post(endpoint, makeQuery(batchSize, skip))
            if (response?.data?.data?.daos) {
                if (response.data.data.daos.length === 0) {
                    finishedFetching = true
                } else {
                    const formatted = response.data.data.daos.map((el: any) => ({ contractAddress: el.id }))
                    kernels = [...kernels, ...formatted]
                    skip += batchSize
                }
            } else {
                finishedFetching = true
                console.log("Received an error with the response. Fallback to --file")
                console.log(response?.data?.errors || response)
            }
        } catch (error) {
            console.log("Received an error fetching the kernels. Fallback to --file")
            console.log(error)
            finishedFetching = true
        }
    }

    console.log(`Fetched ${kernels.length} kernels`)
    return kernels
}

export enum SortProperty {
    name = "name",
}

export enum SortOrder {
    ASC = "Asc",
    DESC = "Desc",
}

export const getKernelsSuperdaoDB = async (env: Environment, batchSize: number) => {
    if (batchSize <= 0) {
        throw new Error("BatchSize should be a positive number")
    }

    const makeQuery = (
        limit: number,
        offset: number,
        search: string,
        sortOrder: SortOrder,
        sortProperty: SortProperty
    ) => ({
        query: `
            query allDaos(
                $limit: Int = 20
                $offset: Int = 0
                $search: String
                $sortOrder: SortOrder
                $sortProperty: SortProperty
            ) {
                allDaos(limit: $limit, offset: $offset, search: $search, sortOrder: $sortOrder, sortProperty: $sortProperty) {
                    count
                    items {
                        contractAddress
                    }
                }
            }        
            `,
        variables: { limit, offset, search, sortOrder, sortProperty },
    })

    let kernels: ContractJSON[] = []

    const endpoint = env === Environment.STAGE ? superdaoStage : superdaoMainnet
    const config = {
        headers: {
            cookie: env === Environment.STAGE ? auth["stage.superdao.co"] : auth["app.superdao.co"],
        },
    }

    const response = await axios.post(endpoint, makeQuery(0, 0, "", SortOrder.ASC, SortProperty.name), config)
    const fetchedData = response.data.data.allDaos.items
    kernels = [...kernels, ...fetchedData.filter((el: any) => el.contractAddress !== null)]
    console.log(`Fetched ${kernels.length} kernels`)
    return kernels
}
