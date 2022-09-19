import hre from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { VERBOSE } from "../hardhat.config";
import { GitConsensus, GitConsensus__factory } from "../types";
import { deployWait } from "./utils";

// This file contains helper functions for deploying contracts, used both for
// real deployments to mainnet/testnets and for integration testing.

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
