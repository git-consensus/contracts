# [Contributing to Git Consensus Contracts](#contributing-to-git-consensus-contracts)

This is a modern Ethereum contract repository for Solidity contracts. It combines two extremely powerful frameworks:

- [Foundry](#foundry) - for Unit testing written in Solidity ([contracts/test/](./contracts/test/))
- [Hardhat](#hardhat) - for Integration testing written in Typescript ([integration/](./integration/))

These also offer some great tools for some advanced things like contract debugging, deployment, gas measurements, etc.

### [Directory Structure](#directory-structure)

```txt
integration/ - "Integration tests with Hardhat"
|- git-consensus.test.ts
scripts/
|- console.ts - "Terminal CLI functions"
|- deploy.ts - "Contract deployment functions"
contracts/
|- interfaces/
|--- IGitConsensus.sol - "Git Consensus Interface"
|- lib/ - "Utility functions"
|--- Utils.sol
|- test/ - "Unit tests with Foundry"
|--- GitConsensus.t.sol
|- GitConsensus.sol - "Git Consensus Implementation"`
.env - "Real dot env"
.env.example - "Example dot env"
.eslintignore - "Ignore list for eslint"
.eslintrc - "Configure eslint"
.gitignore - "Ignore list for Git"
.solcover.js - "Configure coverage"
.solhint.json - "Configure Solidity linter"
.prettierignore - "Ignore list for Prettier"
.prettierrc.json - "Configure Prettier"
deployments.json - "List of contract addresses on each network"
foundry.toml - "Configure Foundry"
hardhat.config.ts - "Configure Hardhat"
import-sorter.json - "Configure Typescript import sort extension"
LICENSE - "Software license"
package.json - "Node dependencies"
slither.config.json - "Configure Slither"
tsconfig.json - "Configure Typescript"
```

--- *(not an extensive list of all files)* ---

&nbsp;

## [Setup](#setup)

Clone the repository:

```sh
git clone https://github.com/git-consensus/contract.git && cd contracts
```

Install [Node.js / NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm):

```sh
npm install --global npm
```

Install [Yarn](https://classic.yarnpkg.com/en/):

```sh
npm install --global yarn
```

Install [Nodegit](https://github.com/nodegit/nodegit) dependencies:

```sh
apt-get install -y python2 python3 libkrb5-dev gcc openssl libssh2-1-dev libcurl4-openssl-dev g++ make
```

Install Node dependencies ([node_modules/](./node_modules/)):

```sh
yarn install
```

#### [Foundry](#foundry)

First run the command below to get `foundryup`, the Foundry toolchain installer:

```sh
curl -L https://foundry.paradigm.xyz | bash
```

Then, in a new terminal session or after reloading your `PATH`, run it to get
the latest `forge` and `cast` binaries:

```sh
foundryup
```

Advanced ways to use `foundryup`, and other documentation, can be found in the [foundryup package](./foundryup/README.md).
Foundry is a blazing fast, portable and modular toolkit for Ethereum application development. It consists of:

- **Forge**: Library for Unit / Fuzz testing written in Solidity (see [contracts/test/](./contracts/test/)).
- **Cast**: Library for interacting with a live Ethereum JSON-RPC compatible node, or for parsing data. A swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.

Need help getting started with Foundry? Read the [📖 Foundry Book](https://onbjerg.github.io/foundry-book/)

#### [Hardhat](#hardhat)

Hardhat is an Ethereum development environment for professionals. We use the [Hardhat Network](https://hardhat.org/hardhat-network/) for Integration testing which written in Typescript. It uses Ethers.js and Mocha/Chai. See [integration/](./integration/) for how it's used in Git Consensus.

On [Hardhat's website](https://hardhat.org) you will find:

- [Guides to get started](https://hardhat.org/getting-started/)
- [Hardhat Network](https://hardhat.org/hardhat-network/)
- [Plugin list](https://hardhat.org/plugins/)

&nbsp;

## [Do Things](#do-things)

Finished [Setup](#setup)?

#### [Run the unit tests with Forge](#run-the-unit-tests-with-forge)

```sh
forge test
```

#### [Run the integration tests with Hardhat](#run-the-integration-tests-with-hardhat)

```sh
yarn test
```

#### [Deploy to Goerli test network](#deploy-to-goerli-test-network)

Create a [.env](./.env) file matching the variables seen in [.env.example](./.env.example)

Getting fully prepared may involve getting a [INFURA_API_KEY](https://infura.io/) by signing up, and getting some test ETH on your target network via a facet.

Then run:

```sh
yarn deploy --network goerli
```

#### [Generate contract API docs](#generate-contract-api-docs)

Ensure `../docs` path exists for [the docs repo](https://github.com/git-consensus/docs). If it *isn't*:

```sh
git clone https://github.com/git-consensus/docs.git ../docs
```

Now you can automatically convert NatSpec comments in contracts to docs with:

```sh
yarn doc
```

&nbsp;

### [Recommended VSCode Extensions](#recommended-vscode-extensions)

- [Solidity Visual Developer](https://marketplace.visualstudio.com/items?itemName=tintinweb.solidity-visual-auditor)
- [Solidity Language & Themes (only)](https://marketplace.visualstudio.com/items?itemName=tintinweb.vscode-solidity-language)
- [Solidity (by Hardhat authors)](https://marketplace.visualstudio.com/items?itemName=NomicFoundation.hardhat-solidity)
- [Solidity (by Juan Blanco)](https://marketplace.visualstudio.com/items?itemName=JuanBlanco.solidity)
- [ETHover](https://marketplace.visualstudio.com/items?itemName=tintinweb.vscode-ethover)
- [Prettier](https://marketplace.visualstudio.com/items?itemName=SimonSiefke.prettier-vscode)
- [Template String Converter](https://marketplace.visualstudio.com/items?itemName=meganrogge.template-string-converter)
- [TypeScript Import Sorter](https://marketplace.visualstudio.com/items?itemName=mike-co.import-sorter)

&nbsp;

### [Style Guide](#style-guide)

- Add Solidity comments in the [natspec](https://docs.soliditylang.org/en/v0.8.15/natspec-format.html) format.
- Always `yarn pretty` your before committing.
- Lowercase commit message (for consistency).
- Embed your Ethereum address in your commit message on this repository.
- Integration testing with Mocha/Chai asserts: `expect(actual).to.equal(expected)`
- Use [Template Literals where possible](https://ponyfoo.com/articles/template-literals-strictly-better-strings).
- Use same consistent pattern for import ordering.

In general, please do your best to always keep this repository beautiful! ❤️

&nbsp;

### [Contract Dependencies](#contract-dependencies)

- OpenZepplin
  - [ERC20](https://docs.openzeppelin.com/contracts/4.x/api/token/erc20#ERC20)
  - [Governor](https://docs.openzeppelin.com/contracts/4.x/api/governance#governor)
  - [Clones](https://docs.openzeppelin.com/contracts/4.x/api/proxy#Clones)
