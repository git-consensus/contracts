import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber, BytesLike } from "ethers";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
    ALICE_ADDR,
    BOB_ADDR,
    CHARLIE_ADDR,
    DAVE_ADDR,
    GitConsensusErrors,
    ZERO_ADDRESS,
} from "../scripts";
import { deployGitConsensus } from "../scripts/deploy";
import { parseEvent, submitTxFail } from "../scripts/utils";
import { GitConsensus } from "../types";
import { IGitConsensusTypes } from "../types/contracts/interfaces/IGitConsensus.sol/IGitConsensus";
import {
    Commit,
    commitExamplesNoAddr,
    commitExamplesWithAddr,
    Tag,
    tagExamplesNoAddr,
    tagExamplesWithAddr,
} from "./example";

chai.use(solidity);
const { expect } = chai;

describe(`Git Consensus tests`, () => {
    let gitConsensus: GitConsensus;

    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let charlie: SignerWithAddress;
    let dave: SignerWithAddress;

    let commitsNoAddr: Commit[];
    let commitsWithAddr: Commit[];
    let tagsNoAddr: Tag[];
    let tagsWithAddr: Tag[];

    context(`commits`, async () => {
        it(`should succeed single commit that have address`, async () => {
            const randAddr: BytesLike = ethers.Wallet.createRandom().address;

            const commitData: IGitConsensusTypes.CommitDataStruct = {
                tree: `tree 01b2a2f9aa2d1d1df4299fad6ed02bb20841b1fd\n`,
                parents: `parents 4a793d306153b16e4bf680a11d01674b9b537f02\n`,
                author: `Satoshi Nakamoto 1208691178 -0400\n`,
                committer: `Satoshi Nakamoto 1208691178 -0400\n`,
                message: `\ngood commit ${randAddr}\n`,
                signature: ``,
            };

            await expect(gitConsensus.addCommit(commitData)).to.not.be.reverted;
        });

        it(`should succeed single commit that have address no space`, async () => {
            const randAddr: BytesLike = ethers.Wallet.createRandom().address;

            const commitData: IGitConsensusTypes.CommitDataStruct = {
                tree: `tree 01b2a2f9aa2d1d1df4299fad6ed02bb20841b1fd\n`,
                parents: `parents 4a793d306153b16e4bf680a11d01674b9b537f02\n`,
                author: `Satoshi Nakamoto 1208691178 -0400\n`,
                committer: `Satoshi Nakamoto 1208691178 -0400\n`,
                message: `\ngood commit${randAddr}\n`,
                signature: ``,
            };

            await expect(gitConsensus.addCommit(commitData)).to.not.be.reverted;
        });

        // TODO: look into weird node error - it definitely fails / reverts so just
        // skipping for now, most likely fails when trying to parse the address but
        // a real error we could throw would be better.
        it.skip(`should fail all commit that have partial address`, async () => {
            const commitData: IGitConsensusTypes.CommitDataStruct = {
                tree: `tree 01b2a2f9aa2d1d1df4299fad6ed02bb20841b1fd\n`,
                parents: `parents 4a793d306153b16e4bf680a11d01674b9b537f02\n`,
                author: `Satoshi Nakamoto 1208691178 -0400\n`,
                committer: `Satoshi Nakamoto 1208691178 -0400\n`,
                message: `\nmy commit 0x has index the contract looks for but not full address\n`,
                signature: ``,
            };
            await submitTxFail(gitConsensus.addCommit(commitData));
        });

        it(`[loop] should succeed all example commit that have address`, async () => {
            for (const commit of commitsWithAddr) {
                expect(await gitConsensus.commitExists(`0x` + commit.hash)).to.equal(false);

                expect(await gitConsensus.commitAddr(`0x` + commit.hash)).to.equal(ZERO_ADDRESS);

                const addCommitTx1 = await gitConsensus.addCommit(commit.data);

                const addCommitLogs = parseEvent(await addCommitTx1.wait(), gitConsensus.interface);
                expect(addCommitLogs.length).to.equal(1);
                expect(addCommitLogs[0].args.ownerAddr).to.equal(commit.ownerAddr);
                expect(addCommitLogs[0].args.commitHash).to.equal(`0x${commit.hash}`);

                expect(await gitConsensus.commitExists(`0x` + commit.hash)).to.equal(true);
                expect(await gitConsensus.commitAddr(`0x` + commit.hash)).to.equal(
                    commit.ownerAddr,
                );
            }
        });

        it(`[loop] should fail all example commit that have no address`, async () => {
            for (const commit of commitsNoAddr) {
                await submitTxFail(
                    gitConsensus.addCommit(commit.data),
                    GitConsensusErrors.MSG_NEEDS_ADDR,
                );

                expect(await gitConsensus.commitExists(`0x` + commit.hash)).to.equal(false);
                expect(await gitConsensus.commitAddr(`0x` + commit.hash)).to.equal(ZERO_ADDRESS);
            }
        });
    });

    context(`releases`, async () => {
        it(`should fail release with different size hash and value arrays`, async () => {
            const tag: Tag = tagsWithAddr[0];
            const hashes: BytesLike[] = [
                `0x` + commitsWithAddr[0].hash,
                `0x` + commitsWithAddr[1].hash,
            ];
            const values: BigNumber[] = [BigNumber.from(10)];
            await submitTxFail(
                gitConsensus.addRelease(tag.data, hashes, values),
                GitConsensusErrors.DISTRIBUTION_LENGTH_MISMATCH,
            );
        });

        it(`[loop] should fail all example tag that have no address`, async () => {
            const hashes: BytesLike[] = [
                `0x` + commitsWithAddr[0].hash,
                `0x` + commitsWithAddr[1].hash,
            ];
            const values: BigNumber[] = [BigNumber.from(100), BigNumber.from(50)];

            for (const tag of tagsNoAddr) {
                await submitTxFail(
                    gitConsensus.addRelease(tag.data, hashes, values),
                    GitConsensusErrors.MSG_NEEDS_ADDR,
                );

                expect(await gitConsensus.tagExists(`0x` + tag.hash)).to.equal(false);
                expect(await gitConsensus.tagAddr(`0x` + tag.hash)).to.equal(ZERO_ADDRESS);
            }
        });

        // TODO: more thorough testing for addRelease, which requires governor/token
    });

    beforeEach(async () => {
        const [deployer, aliceSigner, bobSigner, charlieSigner, daveSigner] =
            await ethers.getSigners();

        // If these addresses are mis-aligned, the embedded address in commit/tag messages
        // will be incorrect. When using hardhat network, ethers.getSigners() should return
        // same as the constants.
        expect(await aliceSigner.getAddress()).to.eq(ALICE_ADDR);
        expect(await bobSigner.getAddress()).to.eq(BOB_ADDR);
        expect(await charlieSigner.getAddress()).to.eq(CHARLIE_ADDR);
        expect(await daveSigner.getAddress()).to.eq(DAVE_ADDR);

        alice = aliceSigner;
        bob = bobSigner;
        charlie = charlieSigner;
        dave = daveSigner;

        commitsNoAddr = await commitExamplesNoAddr();
        commitsWithAddr = await commitExamplesWithAddr();
        tagsNoAddr = await tagExamplesNoAddr();
        tagsWithAddr = await tagExamplesWithAddr();

        gitConsensus = await deployGitConsensus(deployer);
    });
});
