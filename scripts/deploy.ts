import { BigNumberish, BytesLike, ContractReceipt } from "ethers";
import hre, { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { VERBOSE } from "../hardhat.config";
import {
    GitConsensus,
    GitConsensus__factory,
    GovernorFactory,
    GovernorFactory__factory,
    GovernorImpl,
    GovernorImpl__factory,
    TokenFactory,
    TokenFactory__factory,
    TokenImpl,
    TokenImpl__factory,
} from "../types";
import { deployWait, parseEvent, submitTxWait } from "./utils";

// --- Helper functions for deploying contracts ---

// Also adds them to hardhat-tracer nameTags, which gives them a trackable name
// when `npx hardhat test --logs` is used.

// deployGitConsensus deploys the GitConsensus contract.
export async function deployGitConsensus(deployer: SignerWithAddress): Promise<GitConsensus> {
    const gitConsensus: GitConsensus__factory = await hre.ethers.getContractFactory(
        `GitConsensus`,
        deployer,
    );
    const gitConsensusContract = await deployWait(gitConsensus.deploy());

    if (VERBOSE) console.log(`GitConsensus: ${gitConsensusContract.address}`);
    hre.tracer.nameTags[gitConsensusContract.address] = `GitConsensus`;

    return gitConsensusContract;
}

// deployTokenFactory deploys the TokenFactory contract, which allows repositories to deploy
// a clone (gas efficent minimal-proxy) of the TokenImpl contract.
export async function deployTokenFactory(deployer: SignerWithAddress): Promise<TokenFactory> {
    // Deploy token implementation contract
    const tokenImpl: TokenImpl__factory = await hre.ethers.getContractFactory(
        `TokenImpl`,
        deployer,
    );
    const tokenImplContract: TokenImpl = await deployWait(tokenImpl.deploy());
    if (VERBOSE) console.log(`TokenImpl address: ${tokenImplContract.address}`);
    hre.tracer.nameTags[tokenImplContract.address] = `TokenImpl`;

    // Deploy token factory contract, which creates proxy contracts based on the token implementation
    const tokenFactory: TokenFactory__factory = await hre.ethers.getContractFactory(
        `TokenFactory`,
        deployer,
    );
    const tokenFactoryContract: TokenFactory = await deployWait(
        tokenFactory.deploy(tokenImplContract.address),
    );
    if (VERBOSE) console.log(`TokenFactory address: ${tokenFactoryContract.address}`);
    hre.tracer.nameTags[tokenFactoryContract.address] = `TokenFactory`;

    return tokenFactoryContract;
}

// deployGovernorFactory deploys the GovernorFactory contract, which allows repositories to deploy
// a clone (gas efficent minimal-proxy) of the GovernorImpl contract.
export async function deployGovernorFactory(deployer: SignerWithAddress): Promise<GovernorFactory> {
    // Deploy governor implementation contract
    const governorImpl: GovernorImpl__factory = await hre.ethers.getContractFactory(
        `GovernorImpl`,
        deployer,
    );
    const governorImplContract: GovernorImpl = await deployWait(governorImpl.deploy());
    if (VERBOSE) console.log(`GovernorImpl address: ${governorImplContract.address}`);
    hre.tracer.nameTags[governorImplContract.address] = `GovernorImpl`;

    // Deploy governor factory contract, which creates proxy contracts based on the governor implementation
    const governorFactory: GovernorFactory__factory = await hre.ethers.getContractFactory(
        `GovernorFactory`,
        deployer,
    );
    const governorFactoryContract: GovernorFactory = await deployWait(
        governorFactory.deploy(governorImplContract.address),
    );
    if (VERBOSE) console.log(`GovernorFactory address: ${governorFactoryContract.address}`);
    hre.tracer.nameTags[governorFactoryContract.address] = `GovernorFactory`;

    return governorFactoryContract;
}

// createTokenClone Creates a Token Clone and returns a type declaration for that contract instance.
export async function createTokenClone(
    tokenFactoryAddr: string,
    gitConsensusAddr: string,
    governorAddr: string,
    creator: SignerWithAddress,
    name: string,
    symbol: string,
    maxMintablePerHash: BigNumberish,
    owners: string[],
    values: BigNumberish[],
    salt: BytesLike,
    gasLimit?: number,
): Promise<TokenImpl> {
    const tokenFactory = await ethers.getContractAt(`TokenFactory`, tokenFactoryAddr);

    // Distribution size differences will mean that automatic gas limit from ethers may fail,
    // and probably should be explicitly set in all cases distribution array length is greater than 1.
    // See: https://docs.ethers.io/v5/troubleshooting/errors/#help-UNPREDICTABLE_GAS_LIMIT
    // TODOL Some function that ups the predicted gas by some factor for each element in the array.
    let txReceipt: ContractReceipt;
    if (gasLimit != undefined && gasLimit != 0) {
        txReceipt = await submitTxWait(
            tokenFactory
                .connect(creator)
                .createToken(
                    governorAddr,
                    gitConsensusAddr,
                    name,
                    symbol,
                    maxMintablePerHash,
                    owners,
                    values,
                    salt,
                    {
                        gasLimit: gasLimit,
                    },
                ),
        );
    } else {
        txReceipt = await submitTxWait(
            tokenFactory
                .connect(creator)
                .createToken(
                    governorAddr,
                    gitConsensusAddr,
                    name,
                    symbol,
                    maxMintablePerHash,
                    owners,
                    values,
                    salt,
                ),
        );
    }

    const tokenAddr: string = parseEvent(txReceipt, tokenFactory.interface)[0].args.instanceAddr;
    if (VERBOSE) console.log(`TokenClone address: ${tokenAddr}`);
    hre.tracer.nameTags[tokenAddr] = `TokenClone`;

    return await ethers.getContractAt(`TokenImpl`, tokenAddr);
}

// createGovernorClone Creates a Governor Clone and returns a type declaration for that contract instance.
export async function createGovernorClone(
    governorFactoryAddr: string,
    tokenAddr: string,
    creator: SignerWithAddress,
    name: string,
    votingDelay: number,
    votingPeriod: number,
    proposalThreshold: number,
    quorumNumerator: number,
    salt: BytesLike,
    gasLimit?: number,
): Promise<GovernorImpl> {
    const governorFactory = await ethers.getContractAt(`GovernorFactory`, governorFactoryAddr);

    let txReceipt: ContractReceipt;
    if (gasLimit != undefined && gasLimit != 0) {
        txReceipt = await submitTxWait(
            governorFactory
                .connect(creator)
                .createGovernor(
                    tokenAddr,
                    name,
                    votingDelay,
                    votingPeriod,
                    proposalThreshold,
                    quorumNumerator,
                    salt,
                    {
                        gasLimit: gasLimit,
                    },
                ),
        );
    } else {
        txReceipt = await submitTxWait(
            governorFactory
                .connect(creator)
                .createGovernor(
                    tokenAddr,
                    name,
                    votingDelay,
                    votingPeriod,
                    proposalThreshold,
                    quorumNumerator,
                    salt,
                ),
        );
    }

    const governorAddr: string = parseEvent(txReceipt, governorFactory.interface)[0].args
        .instanceAddr;
    if (VERBOSE) console.log(`GovernorClone address: ${governorAddr}`);
    hre.tracer.nameTags[governorAddr] = `GovernorClone`;

    return await ethers.getContractAt(`GovernorImpl`, governorAddr);
}
