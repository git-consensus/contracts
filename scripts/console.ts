import { BigNumber, BigNumberish, Contract, utils } from "ethers";
import { ethers, network } from "hardhat";
import { keyInSelect, keyInYNStrict, question } from "readline-sync";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import deployments from "../deployments.json";
import {
    EXAMPLE_GOVERNOR_NAME,
    EXAMPLE_TOKEN_NAME,
    EXAMPLE_TOKEN_SYMBOL,
    EXAMPLE_VOTING_DELAY_BLOCKS,
    EXAMPLE_VOTING_PERIOD_BLOCKS,
    EXAMPLE_VOTING_PROPOSAL_THRESHOLD,
    EXAMPLE_VOTING_QUORUM_PERCENT,
} from "./const";
import {
    createGovernorClone,
    createTokenClone,
    deployGitConsensus,
    deployGovernorFactory,
    deployTokenFactory,
} from "./deploy";
import { saltToHex } from "./utils";

// --- Provides a CLI to deploy the possible contracts ---

// TODO: Hardware Wallet support:
// https://docs.ethers.io/v5/api/other/hardware/

const CLONE_USAGE = `USER - onboard a project to GitConsensus (create a Token & Governor)`;
const DEV_USAGE = `DEV - deploy GitConsensus, TokenFactory, or GovernorFactory`;

const BOTH_CLONE = `Token & Governor`;
const TOKEN_CLONE = `Token`;
const GOVERNOR_CLONE = `Governor`;
const GIT_CONSENSUS = `GitConsensus`;
const TOKEN_FACTORY = `TokenFactory`;
const GOVERNOR_FACTORY = `GovernorFactory`;

async function main(signer?: SignerWithAddress) {
    if (signer == undefined) {
        signer = await askForSigner();
    }
    switch (askForUsage()) {
        case CLONE_USAGE:
            switch (askForCloneContracts()) {
                case BOTH_CLONE:
                    await createClones(signer, true, true);
                    main(signer);
                    return;
                case TOKEN_CLONE:
                    await createClones(signer, true, false);
                    main(signer);
                    return;
                case GOVERNOR_CLONE:
                    await createClones(signer, false, true);
                    main(signer);
                    return;
            }
        case DEV_USAGE:
            switch (askForDevContracts()) {
                case GIT_CONSENSUS:
                    await gitConsensus(signer);
                    main(signer);
                    return;
                case TOKEN_FACTORY:
                    await tokenFactory(signer);
                    main(signer);
                    return;
                case GOVERNOR_FACTORY:
                    await governorFactory(signer);
                    main(signer);
                    return;
            }
    }
}

export async function gitConsensus(signer: SignerWithAddress): Promise<void> {
    await deploy(GIT_CONSENSUS, () => deployGitConsensus(signer));
}

export async function tokenFactory(signer: SignerWithAddress): Promise<void> {
    await deploy(TOKEN_FACTORY, () => deployTokenFactory(signer));
}

export async function governorFactory(signer: SignerWithAddress): Promise<void> {
    await deploy(GOVERNOR_FACTORY, () => deployGovernorFactory(signer));
}

export async function createClones(
    signer: SignerWithAddress,
    withToken?: boolean,
    withGovernor?: boolean,
): Promise<string[]> {
    console.log(
        `\nTo create your new Token & Governor, you will be asked to enter the address of the ` +
            `already deployed GitConsensus and Factory contracts that you want to use on ${network.name}. These will ` +
            `be defaulted from the list of the official deployed contracts on ${network.name} which can be found ` +
            `in the git-consensus/contracts deployments.json. Developers may also wish to deploy their own versions of ` +
            `these contracts, in which case you want to enter the address of those instead.\n`,
    );
    const gitConsensusAddr = askForAddress(
        `the address of the GitConsensus contract`,
        `0xE559bc7d69c751718C57f8181BebD0E65ed60A3f`,
    );
    const tokenFactoryAddr = askForAddress(
        `the address of the TokenFactory contract`,
        `0xf825fCCf5D9cC7F27C6e0908Caf468402F5aF7D5`,
    );
    const governorFactoryAddr = askForAddress(
        `the address of the GovernorFactory contract`,
        `0x95146F88A3129263C6dd3E73e439af19DE5C184B`,
    );

    const tokenFactory = await ethers.getContractAt(`TokenFactory`, governorFactoryAddr);
    const governorFactory = await ethers.getContractAt(`GovernorFactory`, governorFactoryAddr);

    const tokenSalt: string = saltToHex(askFor(`token salt`));
    const govSalt: string = saltToHex(askFor(`governor salt`));

    const tokenAddr = await tokenFactory.predictAddress(tokenSalt);
    const governorAddr = await governorFactory.predictAddress(govSalt);

    if (withToken) {
        const tokenName: string = askFor(`token name`, EXAMPLE_TOKEN_NAME);
        const tokenSymbol: string = askFor(`token symbol`, EXAMPLE_TOKEN_SYMBOL);
        const maxMintablePerHash: BigNumberish = askForNumber(`max mintable per hash (0 indicates no max)`, "0");
        const buildDistribution: boolean = askYesNo(`Do you want to add an Initial Distribution?`);

        const owners: string[] = [];
        const values: BigNumberish[] = [];
        if (buildDistribution) {
            for (let i = 1; ; i++) {
                const ownerAddr = askForAddress(`owner address #${i} in Initial Distribution`);
                owners.push(ownerAddr);
                values.push(askForNumber(`initial token balance of address #${i} (${ownerAddr})`));

                console.log(`\nCurrent Initial Distribution:\n`);
                printDistribution(owners, values);

                if (!askYesNo(`add more?`)) {
                    break;
                }
            }
            console.log(`\nFinal Initial Distribution:\n`);
            printDistribution(owners, values);
        }

        // TODO: getting incorrect values this (only the final one is correct), and they should match
        console.log(`Your predicted Token address ${etherscanAddress(network.name, tokenAddr)}\n`);

        const token = await createTokenClone(
            tokenFactoryAddr,
            gitConsensusAddr,
            governorAddr,
            signer,
            tokenName,
            tokenSymbol,
            maxMintablePerHash,
            owners,
            values,
            tokenSalt,
        );

        console.log(`Your Token has been deployed with address ${token.address}`);
        // TODO: link to a doc that goes in details about token address in tag usage
        console.log(
            `Always include this address in your Git annotated tag message for it to be valid in Git Consensus addRelease()`,
        );

        // const update = askYesNo(
        //     `NOT IMPLEMENTED YET - Update deployments.json with new TokenFactory address ${token.address}?`,
        // );
    }

    if (withGovernor) {
        const governorName: string = askFor(`governor name`, EXAMPLE_GOVERNOR_NAME);
        const votingDelay: number = askForNumber(
            `voting delay`,
            EXAMPLE_VOTING_DELAY_BLOCKS.toString(),
        );
        const votingPeriod: number = askForNumber(
            `voting period`,
            EXAMPLE_VOTING_PERIOD_BLOCKS.toString(),
        );
        const proposalThreshold: number = askForNumber(
            `proposal threshold`,
            EXAMPLE_VOTING_PROPOSAL_THRESHOLD.toString(),
        );
        const quorumNumerator: number = askForNumber(
            `quorum numerator`,
            EXAMPLE_VOTING_QUORUM_PERCENT.toString(),
        );

        // TODO: getting incorrect values this (only the final one is correct), and they should match
        console.log(
            `Your predicted Governor address ${etherscanAddress(network.name, governorAddr)}`,
        );

        const governor = await createGovernorClone(
            governorFactoryAddr,
            tokenAddr,
            signer,
            governorName,
            votingDelay,
            votingPeriod,
            proposalThreshold,
            quorumNumerator,
            govSalt,
        );

        console.log(`Your Governor has been deployed with address ${governor.address}`);

        // const update = askYesNo(
        //     `NOT IMPLEMENTED YET - Update deployments.json with new GovernorFactory address ${governor.address}?`,
        // );
    }

    return [tokenAddr, governorAddr];
}

// --- Deployment and input handling helpers ---

// source of most of these are from Radicle:
// https://github.com/radicle-dev/radicle-contracts/blob/7070d51fdd8f99790b8fb4e4c953351fd417839a/src/deploy-to-network.ts

async function deploy<T extends Contract>(name: string, fn: () => Promise<T>): Promise<T> {
    for (;;) {
        try {
            console.log(`Deploying`, name, `contract...`);

            const contract = await fn();
            const net = await contract.provider.getNetwork();

            console.log(name, `address:`, etherscanAddress(net.name, contract.address));
            console.log(
                name,
                `transaction:`,
                etherscanTx(net.name, contract.deployTransaction.hash),
            );
            if (contract.deployTransaction.gasPrice) {
                console.log(`Gas price:`, contract.deployTransaction.gasPrice.toString(), `wei`);
            }
            console.log(`Deployer address:`, contract.deployTransaction.from, `\n`);

            // TODO: update deployments.json with new address
            // something like:

            // const update = askYesNo(
            //     `TODO - Update deployments.json with new ${name} address ${contract.address}?`,
            // );
            // if (update) {
            //     console.log(deployments);
            //     const locations: Array<string> = JSON.parse(JSON.stringify(deployments)).location;

            //     var network: string[] = deployments.ropsten;
            //     const dayKey: keyof Schedule = 'monday';
            //     let values2 = deployments.reduce((acc: { [key: string]: number}, deployments) => {
            //         acc[product] = 1; //No more error
            //         return acc;
            //     }, {})
            //     Object.keys(deployments).forEach(key => {
            //         console.log(deployments[key as keyof string]);
            //     });

            //     deployments.deployments[network.name][name] = contract.address;
            //     fs.writeFileSync(
            //         path.join(__dirname, "..", "deployments.json"),
            //         JSON.stringify(deployments, null, 2),
            //     );
            // }

            return contract;
        } catch (e) {
            console.log(`Failed to deploy`, name, `contract, error:`, e);
            if (askYesNo(`Retry?`) == false) {
                throw `Deployment failed`;
            }
        }
    }
}

function etherscanAddress(net: string, addr: string): string {
    if (net == `mainnet`) {
        return `https://etherscan.io/address/` + addr;
    }
    return `https://` + net + `.etherscan.io/address/` + addr;
}

function etherscanTx(net: string, txHash: string): string {
    if (net == `mainnet`) {
        return `https://etherscan.io/tx/` + txHash;
    }
    return `https://` + net + `.etherscan.io/tx/` + txHash;
}

function askForUsage(): string {
    const usage = [CLONE_USAGE, DEV_USAGE];
    const network = keyInSelect(usage, `Please enter your intended usage`, { cancel: true });
    return usage[network];
}

function askForCloneContracts(): string {
    const contracts = [BOTH_CLONE, TOKEN_CLONE, GOVERNOR_CLONE];
    const choice = keyInSelect(contracts, `Enter the contract to deploy`, {
        cancel: false,
    });
    return contracts[choice];
}

function askForDevContracts(): string {
    const contracts = [GIT_CONSENSUS, TOKEN_FACTORY, GOVERNOR_FACTORY];
    const choice = keyInSelect(contracts, `Enter the contract to deploy`, { cancel: false });
    return contracts[choice];
}

async function askForSigner(): Promise<SignerWithAddress> {
    const signers = await ethers.getSigners();
    console.log(`Your available BIP-44 derivation path (m/44'/60'/0'/0) account signers to use:`);
    for (let i = 1; i <= signers.length; i++) {
        console.log(i, await signers[i - 1].getAddress());
    }
    const accountNumber = askForNumber(`the signer you wish to use (1-${signers.length})`);
    const deployer = signers[accountNumber - 1];
    return deployer;
}

function askForGasPrice(gasUsage: string, defaultPrice: BigNumber): BigNumber {
    const giga = 10 ** 9;
    const question = `gas price ` + gasUsage + ` in GWei`;
    const defaultPriceGwei = (defaultPrice.toNumber() / giga).toString();
    for (;;) {
        const priceStr = askFor(question, defaultPriceGwei);
        const price = parseFloat(priceStr);
        if (Number.isFinite(price) && price >= 0) {
            const priceWei = (price * giga).toFixed();
            return BigNumber.from(priceWei);
        }
        printInvalidInput(`amount`);
    }
}

function askForAmount(amountUsage: string, decimals: number, symbol: string): BigNumber {
    const amount = askForBigNumber(`amount ` + amountUsage + ` in ` + symbol);
    return BigNumber.from(10).pow(decimals).mul(amount);
}

function askForBigNumber(numberUsage: string): BigNumber {
    for (;;) {
        const bigNumber = askFor(numberUsage);
        try {
            return BigNumber.from(bigNumber);
        } catch (e) {
            printInvalidInput(`number`);
        }
    }
}

function askForTimestamp(dateUsage: string): number {
    for (;;) {
        const dateStr = askFor(
            `the date ` +
                dateUsage +
                ` in the ISO-8601 format, e.g. 2020-01-21, the timezone is UTC if unspecified`,
        );
        try {
            const date = new Date(dateStr);
            return date.valueOf() / 1000;
        } catch (e) {
            printInvalidInput(`date`);
        }
    }
}

function askForDaysInSeconds(daysUsage: string): number {
    const days = askForNumber(daysUsage + ` in whole days`);
    return days * 24 * 60 * 60;
}

function askYesNo(query: string): boolean {
    return keyInYNStrict(query);
}

function askForNumber(numberUsage: string, defaultInput?: string): number {
    for (;;) {
        const numStr = askFor(numberUsage, defaultInput);
        const num = parseInt(numStr);
        if (Number.isInteger(num)) {
            return num;
        }
        printInvalidInput(`number`);
    }
}

function askForAddress(addressUsage: string, defaultInput?: string): string {
    for (;;) {
        const address = askFor(`the address ` + addressUsage, defaultInput);
        if (utils.isAddress(address)) {
            return address;
        }
        printInvalidInput(`address`);
    }
}

function askFor(query: string, defaultInput?: string, hideInput = false): string {
    const questionDefault = defaultInput === undefined ? `` : ` (default: ` + defaultInput + `)`;
    const options = {
        hideEchoBack: hideInput,
        limit: /./,
        limitMessage: ``,
        defaultInput,
    };
    return question(`Please enter ` + query + questionDefault + `:\n`, options);
}

function printInvalidInput(inputType: string): void {
    console.log(`This is not a valid`, inputType);
}

function printDistribution(owners: string[], values: BigNumberish[]) {
    console.log(
        `                   owners                    |   values   \n` +
            `---------------------------------------------|-------------`,
    );
    for (let i = 0; i < owners.length; i++) {
        console.log(`${owners[i]}   | ${values[i]}`);
    }
    console.log(`\n`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
