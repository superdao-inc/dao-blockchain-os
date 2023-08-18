# @superdao/os
Package consists of following features:
- `artifacts/` folder with `json` of contracts that Superdao team develops 
- `typechain-types/` folder with TypeScript typing classes of contracts in the Superdao OS project. 

# Install 
```bash
npm install --dev @superdao/os
```

# Use
```typescript
import { DAOConstructor } from "@superdao/os/dist/typechain-types";
import DAOConstructorArtifacts from "@superdao/os/dist/contracts/templates/DAOConstructor.sol/DAOConstructor.json";
```

## The Full Example
Typescript file (`index.ts`) example is below:
```typescript
import { DAOConstructor } from "@superdao/os/dist/typechain-types";
import { ethers } from "ethers";
import DAOConstructorArtifacts from "@superdao/os/dist/contracts/templates/DAOConstructor.sol/DAOConstructor.json";

const RPC = "rpc url here";
const DAOConstructorAddress = "address here";


async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const DAOConstructor = new ethers.Contract(DAOConstructorAddress, DAOConstructorArtifacts.abi, provider) as DAOConstructor;

    const owner = await DAOConstructor.owner();
    console.log(owner);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

To run merely use
```bash
ts-node index.ts 
```

### Dependencies of The Full Example
```
"@types/node": "^18.0.0",
"typescript": "^4.7.4",
"@superdao/os": "^0.0.1",
"ethers": "^5.6.9",
"ts-node": "^10.8.1"
```

# Licence
todo
