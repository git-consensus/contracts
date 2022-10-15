# [Contributing to Git Consensus Contracts](#contributing-to-git-consensus-contracts)

This is a modern Ethereum contract repository for Solidity contracts. It combines two extremely powerful frameworks:

-   [Foundry](#foundry) - for Unit testing written in Solidity ([contracts/test/](./contracts/test/))
-   [Hardhat](#hardhat) - for Integration testing written in Typescript ([integration/](./integration/))

These also offer some great tools for some advanced things like contract debugging, deployment, gas measurements, etc.

&nbsp;

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

--- _(not an extensive list of all files)_ ---

&nbsp;

## [Setup](#setup)

#### [Clone the repository](#clone-the-repository):

```sh
git clone https://github.com/git-consensus/contracts.git && cd contracts
```

#### [Install Node.js / NPM](#install-nodejs--npm):

```sh
npm install --global npm
```

This is *probably* already installed though.

#### [Copy over a new `.env` file](#copy-over-a-new-env-file):

```
cp .env.example .env
```

Fill in *at least* your [`MNEMONIC`](https://metamask.zendesk.com/hc/en-us/articles/360015290032-How-to-reveal-your-Secret-Recovery-Phrase) and [`INFURA_API_KEY`](https://docs.infura.io/infura/getting-started).

#### [Setup nodegit dependencies](#setup-nodegit-dependencies):

*   **Mac**:

    ```sh
    xcode-select --install
    npm config set python $(which python2)
    ```

*   **Linux**:

    ```sh
    apt-get install -y python2 python3 libkrb5-dev gcc openssl libssh2-1-dev libcurl4-openssl-dev g++ make
    npm config set python $(whereis python2)
    ```

*   **Windows**:

    Open powershell with administrator privileges and run this command:
    ```sh
    npm install -g --production windows-build-tools
    ```

#### [Install Node dependencies](#install-node-dependencies):

```sh
npm i
```

#### [Install Foundry](#install-foundry)

```sh
curl -L https://foundry.paradigm.xyz | bash
```

Then, in a new terminal session or after reloading your `PATH`, run this to get
the latest [`forge`](https://book.getfoundry.sh/reference/forge/forge) and [`cast`](https://book.getfoundry.sh/reference/cast/cast) binaries:

```sh
foundryup
```

If you've made it this far, the repository setup is now complete! 🎉

&nbsp;

## [Do Things](#do-things)

Finished [Setup](#setup)?

#### [Run the unit tests with Forge](#run-the-unit-tests-with-forge)

```sh
forge test
```

#### [Run the integration tests with Hardhat](#run-the-integration-tests-with-hardhat)

```sh
npm run test
```

#### [Deploy to Goerli test network](#deploy-to-goerli-test-network)

Create a [.env](./.env) file matching the variables seen in [.env.example](./.env.example)

Getting fully prepared may involve getting a [INFURA_API_KEY](https://infura.io/) by signing up, and getting some test ETH on your target network via a facet.

Then run:

```sh
npm run deploy --network goerli
```

#### [Generate contract API docs](#generate-contract-api-docs)

Ensure `../docs` path exists for [the docs repo](https://github.com/git-consensus/docs). If it _isn't_:

```sh
git clone https://github.com/git-consensus/docs.git ../docs
```

Now you can automatically convert NatSpec comments in contracts to docs with:

```sh
npm run doc
```

&nbsp;

### [Foundary & Hardhat Info](#foundary--hardhat-info)

#### [Foundry](#foundry)

Advanced ways to use `foundryup`, and other documentation, can be found in the [foundryup package](./foundryup/README.md).
Foundry is a blazing fast, portable and modular toolkit for Ethereum application development. It consists of:

-   **[Forge](https://book.getfoundry.sh/reference/forge/forge)**: Library for Unit / Fuzz testing written in Solidity (see [contracts/test/](./contracts/test/)).
-   **[Cast]((https://book.getfoundry.sh/reference/cast/cast))**: Library for interacting with a live Ethereum JSON-RPC compatible node, or for parsing data. A swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.

Need help getting started with Foundry? Read the [📖 Foundry Book](https://onbjerg.github.io/foundry-book/)

#### [Hardhat](#hardhat)

Hardhat is an Ethereum development environment for professionals. We use the [Hardhat Network](https://hardhat.org/hardhat-network/) for Integration testing which written in Typescript. It uses Ethers.js and Mocha/Chai. See [integration/](./integration/) for how it's used in Git Consensus.

On [Hardhat's website](https://hardhat.org) you will find:

-   [Guides to get started](https://hardhat.org/getting-started/)
-   [Hardhat Network](https://hardhat.org/hardhat-network/)
-   [Plugin list](https://hardhat.org/plugins/)

&nbsp;

### [Recommended VSCode Extensions](#recommended-vscode-extensions)

-   [Solidity Visual Developer](https://marketplace.visualstudio.com/items?itemName=tintinweb.solidity-visual-auditor)
-   [Solidity Language & Themes (only)](https://marketplace.visualstudio.com/items?itemName=tintinweb.vscode-solidity-language)
-   [Solidity (by Hardhat authors)](https://marketplace.visualstudio.com/items?itemName=NomicFoundation.hardhat-solidity)
-   [Solidity (by Juan Blanco)](https://marketplace.visualstudio.com/items?itemName=JuanBlanco.solidity)
-   [ETHover](https://marketplace.visualstudio.com/items?itemName=tintinweb.vscode-ethover)
-   [Prettier](https://marketplace.visualstudio.com/items?itemName=SimonSiefke.prettier-vscode)
-   [Template String Converter](https://marketplace.visualstudio.com/items?itemName=meganrogge.template-string-converter)
-   [TypeScript Import Sorter](https://marketplace.visualstudio.com/items?itemName=mike-co.import-sorter)

&nbsp;

### [Style Guide](#style-guide)

-   Add Solidity comments in the [natspec](https://docs.soliditylang.org/en/v0.8.15/natspec-format.html) format.
-   Always `npm run pretty` your before committing.
-   Lowercase commit message (for consistency).
-   Embed your Ethereum address in your commit message on this repository.
-   Integration testing with Mocha/Chai asserts: `expect(actual).to.equal(expected)`
-   Use [Template Literals where possible](https://ponyfoo.com/articles/template-literals-strictly-better-strings).
-   Use same consistent pattern for import ordering.

In general, please do your best to always keep this repository beautiful! ❤️

&nbsp;

### [Contract Dependencies](#contract-dependencies)

-   OpenZepplin
    -   [ERC20](https://docs.openzeppelin.com/contracts/4.x/api/token/erc20#ERC20)
    -   [Governor](https://docs.openzeppelin.com/contracts/4.x/api/governance#governor)
    -   [Clones](https://docs.openzeppelin.com/contracts/4.x/api/proxy#Clones)
