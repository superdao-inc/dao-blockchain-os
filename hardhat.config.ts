import { HardhatUserConfig } from "hardhat/config"
import "@typechain/hardhat"
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-waffle"
import "@nomiclabs/hardhat-etherscan"
import "hardhat-deploy"
import "hardhat-contract-sizer"
import "hardhat-gas-reporter"
import "tsconfig-paths/register"
import "@tenderly/hardhat-tenderly"
import "solidity-docgen"
import { config as dotenv } from "dotenv"
import keythereum from "keythereum"
import PATH from "path"

import "@tasks//"

dotenv()

const { DEPLOYER_ADDRESS, DEPLOYER_PASSWORD, FORKING_MODE } = process.env

const getPrivateKey = (address: string | undefined, password: string | undefined) => {
    try {
        const keyObject = keythereum.importFromFile(address!, PATH.resolve())
        return "0x" + (keythereum as any).recover(password!, keyObject).toString("hex")
    } catch (e) {
        return undefined
    }
}

const forkingSettings = process.env?.FORKING_FROM_BLOCK
    ? { blockNumber: parseInt(process.env.FORKING_FROM_BLOCK, 10) }
    : {}

// Sometimes we want to override deployments for forked network (e.g. when use deploy command on fork
// and want to check if hardhat-deploy decide that contract changed)
// ref to https://github.com/wighawag/hardhat-deploy/issues/115#issuecomment-862934117
if (!!process.env.FORKING_MODE_USE_SOURCE_DEPLOYMENTS && !!FORKING_MODE) {
    const saveTo = FORKING_MODE.toLowerCase()
    process.env.HARDHAT_DEPLOY_FORK = saveTo
    console.warn(
        `All new deployments for the fork will be saved into deployments/${saveTo}` +
            " when hardhat-deploy plugin will be used"
    )
}

// When we suppose to fork network via hardhat we usually suppose to use deployments from that network as well
// E.g. we want to have access to deployed implementation on mainnet for integration-test tasks under hardhat network
// specified
const forkingDeploymentsSettings = FORKING_MODE
    ? {
          deployments: {
              hardhat: [`deployments/${FORKING_MODE.toLowerCase()}`],
              localhost: [`deployments/${FORKING_MODE.toLowerCase()}`],
          },
      }
    : undefined

// DRY
const getForkingUrl = () => {
    return !!FORKING_MODE && ["MAINNET", "STAGE"].includes(FORKING_MODE)
        ? process.env.MAINNET_RPC ?? ""
        : process.env.TESTNET_RPC ?? ""
}

// DRY
const getAccounts = (address?: string, password?: string) =>
    getPrivateKey(address, password) ? [getPrivateKey(address, password) as string] : undefined

// DRY
const getNamedAccounts = (address?: string, password?: string) =>
    getPrivateKey(address, password)
        ? [{ privateKey: getPrivateKey(address, password) as string, balance: "100000000000000000" }]
        : undefined

const namedAccounts = {
    deployer: {
        default: 0,
    },
    chainlinkCoordinator: {
        testnet: "0x8C7382F9D8f56b33781fE506E897a4F1e2d17255",
    },
    linkToken: {
        testnet: "0x326C977E6efc84E512bB9C30f76E30c160eD06FB",
    },
    releaseManager: {
        mainnet: "0x22bdc4AA7204f59d78d38d82729bE76CA4e6E4Df",
        testnet: "0xAe38691EA4146d136F58BfA3e8266237eDde2851",
        stage: "0xA0768D6478977443cA62A10660a95b76b01AcA8d",
        hardhat: 1,
        localhost: 1,
        default: 1,
    },
    successTeam: {
        mainnet: "0x736337020906E52ef43542e183eb6f385423d8FE",
        stage: "0x6891E61aE7CaE63263FE6Dc15Bc895f7D4B0eAd1",
        hardhat: 2,
        localhost: 2,
        default: 2,
    },
    sudoWallet: {
        default: "0x22bdc4AA7204f59d78d38d82729bE76CA4e6E4Df",
    },
    uniswapV3Factory: {
        mainnet: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        stage: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    },
    daiAddress: {
        mainnet: "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063",
        stage: "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063",
        default: "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063",
    },
    usdcAddress: {
        mainnet: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
        stage: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
        default: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
    },
    usdtAddress: {
        mainnet: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        stage: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        default: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    },
    wmaticAddress: {
        mainnet: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
        stage: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
        testnet: "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889",
        default: "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889",
    },
    nativeToken: {
        mainnet: "0x0000000000000000000000000000000000001010",
        stage: "0x0000000000000000000000000000000000001010",
        default: "0x0000000000000000000000000000000000000000",
    },
    gnosisSafeFactory: {
        mainnet: "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
        stage: "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
    },
    gnosisSafeSingleton: {
        mainnet: "0x3E5c63644E683549055b9Be8653de26E0B4CD36E",
        stage: "0x3E5c63644E683549055b9Be8653de26E0B4CD36E",
    },
    gnosisSafeFallbackHandler: {
        mainnet: "0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4",
        stage: "0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4",
    },
    updateManager: {
        mainnet: "0xDeB6b06E22A5BdFB2d42000074B46F9C2c3861FE",
    },
}

// todo: how to type this properly?
const getNamedAccount = (accountName: keyof typeof namedAccounts, forkingMode?: string) => {
    // if forkingMode is provided, try to return the correct account,
    // eg: namedAccounts.releaseManager.mainnet
    // @ts-ignore
    if (!!forkingMode && namedAccounts?.[accountName]?.[forkingMode.toLowerCase()]) {
        // @ts-ignore
        return namedAccounts[accountName][forkingMode.toLowerCase()]
    }

    // if forkingMode is not provided, try to return the default value,
    // eg: namedAccounts.successTeam.default
    // @ts-ignore
    if (namedAccounts?.[accountName]?.default) {
        // @ts-ignore
        return namedAccounts[accountName].default
    }

    // if both conditions aren't met, fallback to account 0 (the deployer)
    return 0
}

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            accounts: getNamedAccounts(DEPLOYER_ADDRESS, DEPLOYER_PASSWORD),
            forking: {
                enabled: !!process.env.FORKING_MODE,
                url: getForkingUrl(),
                ...forkingSettings,
            },
            deploy: ["modules/deploy/"],
        },
        localhost: {
            accounts: getAccounts(DEPLOYER_ADDRESS, DEPLOYER_PASSWORD),
            forking: {
                enabled: true,
                url: getForkingUrl(),
                ...forkingSettings,
            },
            deploy: ["modules/deploy/"],
        },
        testnet: {
            url: process.env.TESTNET_RPC ?? "",
            accounts: getAccounts(DEPLOYER_ADDRESS, DEPLOYER_PASSWORD),
            deploy: ["modules/deploy/"],
        },
        mainnet: {
            url: process.env.MAINNET_RPC ?? "",
            accounts: getAccounts(DEPLOYER_ADDRESS, DEPLOYER_PASSWORD),
            gasPrice: 100_000_000_000,
            deploy: ["modules/deploy/"],
        },
        stage: {
            url: process.env.MAINNET_RPC ?? "",
            accounts: getAccounts(DEPLOYER_ADDRESS, DEPLOYER_PASSWORD),
            gasPrice: 200_000_000_000,
            deploy: ["modules/deploy/"],
        },
    },
    // this field overrides the namedAccounts variable from the top of the file
    namedAccounts: {
        ...namedAccounts,
        releaseManager: {
            ...namedAccounts.releaseManager,
            hardhat: getNamedAccount("releaseManager", FORKING_MODE),
            localhost: getNamedAccount("releaseManager", FORKING_MODE),
        },
        successTeam: {
            ...namedAccounts.successTeam,
            hardhat: getNamedAccount("successTeam", FORKING_MODE),
            localhost: getNamedAccount("successTeam", FORKING_MODE),
        },
    },
    solidity: {
        compilers: [
            {
                version: "0.8.12",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                    evmVersion: "london",
                },
            },
        ],
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
    tenderly: {
        project: process.env.TENDERLY_PROJECT_ID!,
        username: process.env.TENDERLY_USERNAME!,
        // todo: tenderly plugin is so annoying: it wants us to declare access key in separate yaml
        // ref: https://www.npmjs.com/package/@tenderly/hardhat-tenderly#usage
    },
    docgen: {
        outputDir: "docs",
        pages: "single",
        theme: "markdown",
        collapseNewlines: true,
        pageExtension: ".md",
    },
    external: {
        ...forkingDeploymentsSettings,
        contracts: [
            {
                artifacts: "node_modules/@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/",
            },
            {
                artifacts: "node_modules/@gnosis.pm/safe-contracts/build/artifacts",
            },
        ],
    },

    paths: {
        tests: "./modules/tests",
    },
}

export default config
