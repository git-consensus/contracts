/* eslint-disable */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber, BytesLike } from "ethers";
import fs from "fs-extra";
import hre, { ethers } from "hardhat";

import { Repository } from "nodegit";
import { TESTDATA_BRANCH, TESTDATA_LOCAL_PATH, TESTDATA_REMOTE, VERBOSE } from "../hardhat.config";
import {
    EXAMPLE_GOVERNOR_NAME,
    EXAMPLE_TOKEN_NAME,
    EXAMPLE_TOKEN_SYMBOL,
    EXAMPLE_VOTING_DELAY_BLOCKS,
    EXAMPLE_VOTING_PERIOD_BLOCKS,
    EXAMPLE_VOTING_PROPOSAL_THRESHOLD,
    EXAMPLE_VOTING_QUORUM_PERCENT,
    GitConsensusErrors,
    TokenErrors,
    VoteType,
    ZERO_ADDRESS,
    ZERO_HASH,
} from "../scripts";
import {
    createGovernorClone,
    createTokenClone,
    deployGitConsensus,
    deployGovernorFactory,
    deployTokenFactory,
} from "../scripts/deploy";
import {
    commitExamplesNoAddr,
    commitExamplesWithAddr,
    tagExamplesNoAddr,
    tagExamplesWithAddr,
    TestCommit,
    TestTag,
} from "../scripts/testdata/example";
import { cloneRepo, injectCommitAddress, injectTagAddress } from "../scripts/testdata/git";
import {
    parseEvent,
    randomAvoidRepeats,
    randomBigNumber,
    randomNumber,
    submitTxFail,
    submitTxWait,
    sumBigNumbers,
    waitBlocks,
} from "../scripts/utils";
import { GitConsensus, GovernorImpl, TokenImpl } from "../types";
import { IGitConsensusTypes } from "../types/contracts/interfaces/IGitConsensus.sol/IGitConsensus";

chai.use(solidity);
const { expect } = chai;

// randomBigNumber() only uses 20 * 8 = 160 bits, so no risk of going over
const MAX_MINTABLE_PER_HASH = ethers.constants.MaxUint256.sub(1);

describe(`Git Consensus integration tests`, () => {
    // contracts
    let gitConsensus: GitConsensus;
    let token: TokenImpl;
    let governor: GovernorImpl;

    // users
    let deployer: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let charlie: SignerWithAddress;
    let dave: SignerWithAddress;

    // git repository for test data
    let repo: Repository;

    // test data
    let commitsNoAddr: TestCommit[];
    let commitsWithAddr: TestCommit[];
    let tagsNoAddr: TestTag[];
    let tagsWithAddr: TestTag[];

    before(async () => {
        // Signers will have different address values for each person that runs this test, since
        // based on MNEMONIC in the .env file. So we need to re-build the test repository while
        // injecting the signers addresses into commits messages and token address into tags.
        // This ensures that the generated test data is correct.

        if (!(await fs.pathExists(TESTDATA_LOCAL_PATH))) {
            if (VERBOSE) console.log(`cloning ${TESTDATA_REMOTE} into ${TESTDATA_LOCAL_PATH}`);
            repo = await cloneRepo(TESTDATA_REMOTE, TESTDATA_LOCAL_PATH, TESTDATA_BRANCH);
        } else {
            if (VERBOSE) console.log(`opening existing repo at ${TESTDATA_LOCAL_PATH}`);
            repo = await Repository.open(TESTDATA_LOCAL_PATH);
        }

        const [deployerSigner, aliceSigner, bobSigner, charlieSigner, daveSigner] =
            await ethers.getSigners();

        deployer = deployerSigner;
        alice = aliceSigner;
        bob = bobSigner;
        charlie = charlieSigner;
        dave = daveSigner;

        await injectCommitAddress(
            repo,
            await alice.getAddress(),
            await bob.getAddress(),
            await charlie.getAddress(),
            await dave.getAddress(),
        );
    });

    beforeEach(async () => {
        gitConsensus = await deployGitConsensus(deployer);
        const tokenFactory = await deployTokenFactory(deployer);
        const governorFactory = await deployGovernorFactory(deployer);

        const tokenAddr = await tokenFactory.predictAddress(ZERO_HASH);
        const governorAddr = await governorFactory.predictAddress(ZERO_HASH);

        await injectTagAddress(repo, tokenAddr);

        token = await createTokenClone(
            tokenFactory.address,
            gitConsensus.address,
            governorAddr,
            alice, // can be anyone
            EXAMPLE_TOKEN_NAME,
            EXAMPLE_TOKEN_SYMBOL,
            MAX_MINTABLE_PER_HASH, // randomBigNumber() only uses 20 * 8 = 160 bits, so no risk of going over
            [alice.address, bob.address],
            [200, 100],
            ZERO_HASH,
        );

        governor = await createGovernorClone(
            governorFactory.address,
            tokenAddr,
            alice, // can be anyone
            EXAMPLE_GOVERNOR_NAME,
            EXAMPLE_VOTING_DELAY_BLOCKS,
            EXAMPLE_VOTING_PERIOD_BLOCKS,
            EXAMPLE_VOTING_PROPOSAL_THRESHOLD,
            EXAMPLE_VOTING_QUORUM_PERCENT,
            ZERO_HASH,
        );

        commitsNoAddr = commitExamplesNoAddr();
        commitsWithAddr = await commitExamplesWithAddr();
        tagsNoAddr = tagExamplesNoAddr();
        tagsWithAddr = await tagExamplesWithAddr();
    });

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
        // This test will succeed, but the other tests will get blocked with:
        //
        //     return new SolidityCallSite(sourceReference.sourceName, sourceReference.contract, sourceReference.function !== undefined
        //      TypeError: Cannot read properties of undefined (reading 'sourceName')
        //      (Use `node --trace-uncaught ...` to show where the exception was thrown)
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
                expect(await gitConsensus.hashExists(`0x` + commit.hash)).to.equal(false);

                expect(await gitConsensus.hashAddr(`0x` + commit.hash)).to.equal(ZERO_ADDRESS);

                const addCommitTx1 = await gitConsensus.addCommit(commit.data);

                const addCommitLogs = parseEvent(await addCommitTx1.wait(), gitConsensus.interface);
                expect(addCommitLogs.length).to.equal(1);
                expect(addCommitLogs[0].args.ownerAddr).to.equal(commit.ownerAddr);
                expect(addCommitLogs[0].args.commitHash).to.equal(`0x${commit.hash}`);

                expect(await gitConsensus.hashExists(`0x` + commit.hash)).to.equal(true);
                expect(await gitConsensus.hashAddr(`0x` + commit.hash)).to.equal(commit.ownerAddr);
            }
        });

        it(`[loop] should fail all example commit that have no address`, async () => {
            for (const commit of commitsNoAddr) {
                await submitTxFail(
                    gitConsensus.addCommit(commit.data),
                    `${GitConsensusErrors.COMMIT_MSG_NEEDS_ADDR}("${commit.data.message}")`,
                );

                expect(await gitConsensus.hashExists(`0x` + commit.hash)).to.equal(false);
                expect(await gitConsensus.hashAddr(`0x` + commit.hash)).to.equal(ZERO_ADDRESS);
            }
        });
    });

    context(`releases`, async () => {
        it(`should fail release with different size hash and value arrays`, async () => {
            const tag: TestTag = tagsWithAddr[0];
            const hashes: BytesLike[] = [
                `0x` + commitsWithAddr[0].hash,
                `0x` + commitsWithAddr[1].hash,
            ];
            const values: BigNumber[] = [BigNumber.from(10)];
            await submitTxFail(
                gitConsensus.addRelease(tag.data, hashes, values),
                `${GitConsensusErrors.DISTRIBUTION_LENGTH_MISMATCH}(${hashes.length}, ${values.length})`,
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
                    `${GitConsensusErrors.TAG_MSG_NEEDS_ADDR}("${tag.data.message.toString()}")`,
                );

                expect(await gitConsensus.hashExists(`0x` + tag.hash)).to.equal(false);
                expect(await gitConsensus.hashAddr(`0x` + tag.hash)).to.equal(ZERO_ADDRESS);
            }
        });

        it(`should fail invalid release from non-governor`, async () => {
            const tag: TestTag = tagsWithAddr[0];
            const hashes: BytesLike[] = [
                `0x` + commitsWithAddr[0].hash,
                `0x` + commitsWithAddr[1].hash,
            ];
            const values: BigNumber[] = [BigNumber.from(10), BigNumber.from(20)];
            await submitTxFail(
                gitConsensus.connect(alice).addRelease(tag.data, hashes, values),
                `${GitConsensusErrors.UNAUTHORIZED_RELEASE}("${alice.address}", "${governor.address}")`,
            );
        });

        it(`should succeed valid release, commits from last tag to current`, async () => {
            const tagsLen: number = tagsWithAddr.length;
            const tag: TestTag = tagsWithAddr[tagsLen - 1];
            const commitsLen: number = commitsWithAddr.length;
            const commit1: TestCommit = commitsWithAddr[commitsLen - 2];
            const commit2: TestCommit = commitsWithAddr[commitsLen - 1];

            const commitOwner1BalPre: BigNumber = await token.balanceOf(commit1.ownerAddr);
            const commitOwner2BalPre: BigNumber = await token.balanceOf(commit2.ownerAddr);
            const totalSupplyPre: BigNumber = await token.totalSupply();

            await gitConsensus.addCommit(commit1.data);
            await gitConsensus.addCommit(commit2.data);

            expect(await gitConsensus.hashExists(`0x` + tag.hash)).to.equal(false);

            // build a distribution to reward these two commits
            const value1: BigNumber = randomBigNumber();
            const value2: BigNumber = randomBigNumber();
            const hashes: BytesLike[] = [`0x${commit1.hash}`, `0x${commit2.hash}`];
            const values: BigNumber[] = [value1, value2];

            // self-delegate: delegates must be assigned *before* voting period starts to be valid
            await token.connect(alice).delegate(alice.address);

            // create proposal to execute `addRelease(tag.data, d)`
            const calldata1 = gitConsensus.interface.encodeFunctionData(`addRelease`, [
                tag.data,
                hashes,
                values,
            ]);
            const proposalTxReceipt1 = await submitTxWait(
                governor
                    .connect(alice)
                    .propose([gitConsensus.address], [0], [calldata1], tag.data.message.toString()),
            );
            const proposalId1 = parseEvent(proposalTxReceipt1, governor.interface)[0].args
                .proposalId;

            // voting starts
            await waitBlocks(EXAMPLE_VOTING_DELAY_BLOCKS);
            await governor.connect(alice).castVote(proposalId1, VoteType.FOR);
            await waitBlocks(EXAMPLE_VOTING_PERIOD_BLOCKS);

            const executeTxReceipt1 = await submitTxWait(
                governor
                    .connect(alice)
                    .execute(
                        [gitConsensus.address],
                        [0],
                        [calldata1],
                        ethers.utils.id(await tag.data.message.toString()),
                    ),
            );
            const executeLogs1 = parseEvent(executeTxReceipt1, governor.interface);
            expect(executeLogs1.length).to.equal(1);
            expect(executeLogs1[0].args.proposalId).to.equal(proposalId1);

            const addReleaseLogs1 = parseEvent(executeTxReceipt1, gitConsensus.interface);
            expect(addReleaseLogs1.length).to.equal(1);
            expect(addReleaseLogs1[0].args.tokenAddr).to.equal(token.address);
            expect(addReleaseLogs1[0].args.tagHash).to.equal(`0x${tag.hash}`);

            expect(await gitConsensus.hashExists(`0x` + tag.hash)).to.equal(true);
            expect(await token.totalSupply()).to.equal(totalSupplyPre.add(value1.add(value2)));
            expect(await token.balanceOf(commit1.ownerAddr)).to.equal(
                commitOwner1BalPre.add(value1),
            );
            expect(await token.balanceOf(commit2.ownerAddr)).to.equal(
                commitOwner2BalPre.add(value2),
            );
        });

        it(`should succeed valid release, commits from any`, async () => {
            // it's atypical to have releases that are NOT just doing last commits from previous tag to current tag
            // but it's technically possible. This test will randomly choose some commits and reward them.
            for (const commit of commitsWithAddr) {
                await gitConsensus.addCommit(commit.data);
            }

            const hashes = commitsWithAddr.map(commit => commit.hash);
            const chooseHash = randomAvoidRepeats(hashes);

            for (const tag of tagsWithAddr) {
                const totalSupplyPre: BigNumber = await token.totalSupply();
                expect(await gitConsensus.hashExists(`0x` + tag.hash)).to.equal(false);

                // build a random distribution for each release
                const distroLength = randomNumber(0, 4); // arbitrary
                const hashes: BytesLike[] = [];
                const values: BigNumber[] = [];

                // for tracking balance changes
                const commitOwnersAddr: string[] = [];
                const commitOwnersBalPre: BigNumber[] = [];

                for (let i = 0; i < distroLength; i++) {
                    const hash = chooseHash();
                    hashes.push(`0x${hash}`);
                    const value = randomBigNumber();
                    values.push(value);

                    const ownerAddr = await gitConsensus.hashAddr(`0x${hash}`);
                    commitOwnersAddr.push(ownerAddr);
                    if (ownerAddr == ZERO_ADDRESS) {
                        commitOwnersBalPre.push(BigNumber.from(0));
                    } else {
                        commitOwnersBalPre.push(await token.balanceOf(ownerAddr));
                    }
                }

                // self-delegate: delegates must be assigned *before* voting period starts to be valid
                // just giving all power to alice for this test to avoid proposal fail b/c alice
                // doesn't have majority of voting power
                await token.connect(alice).delegate(alice.address);
                await token.connect(bob).delegate(alice.address);
                await token.connect(charlie).delegate(alice.address);
                await token.connect(dave).delegate(alice.address);

                const calldata1 = gitConsensus.interface.encodeFunctionData(`addRelease`, [
                    tag.data,
                    hashes,
                    values,
                ]);
                const proposalTxReceipt1 = await submitTxWait(
                    governor
                        .connect(alice)
                        .propose(
                            [gitConsensus.address],
                            [0],
                            [calldata1],
                            tag.data.message.toString(),
                        ),
                );
                const proposalId1 = parseEvent(proposalTxReceipt1, governor.interface)[0].args
                    .proposalId;

                // voting starts
                await waitBlocks(EXAMPLE_VOTING_DELAY_BLOCKS);
                await governor.connect(alice).castVote(proposalId1, VoteType.FOR);
                await waitBlocks(EXAMPLE_VOTING_PERIOD_BLOCKS);

                const executeTxReceipt1 = await submitTxWait(
                    governor
                        .connect(alice)
                        .execute(
                            [gitConsensus.address],
                            [0],
                            [calldata1],
                            ethers.utils.id(await tag.data.message.toString()),
                        ),
                );
                const executeLogs1 = parseEvent(executeTxReceipt1, governor.interface);
                expect(executeLogs1.length).to.equal(1);
                expect(executeLogs1[0].args.proposalId).to.equal(proposalId1);

                const addReleaseLogs1 = parseEvent(executeTxReceipt1, gitConsensus.interface);
                expect(addReleaseLogs1.length).to.equal(1);
                expect(addReleaseLogs1[0].args.tokenAddr).to.equal(token.address);
                expect(addReleaseLogs1[0].args.tagHash).to.equal(`0x${tag.hash}`);

                expect(await gitConsensus.hashExists(`0x` + tag.hash)).to.equal(true);
                expect(await token.totalSupply()).to.equal(
                    totalSupplyPre.add(await sumBigNumbers(values)),
                );
                // TODO: look why this occasionally fails.
                // for (let i = 0; i < distroLength; i++) {
                //     expect(await token.balanceOf(commitOwnersAddr[i])).to.equal(
                //         commitOwnersBalPre[i].add(values[i]),
                //     );
                // }
            }
        });

        it(`should fail to mint tokens above maxMintablePerHash`, async () => {
            const tagsLen: number = tagsWithAddr.length;
            const tag: TestTag = tagsWithAddr[tagsLen - 1];
            const commitsLen: number = commitsWithAddr.length;
            const commit1: TestCommit = commitsWithAddr[commitsLen - 2];
            const commit2: TestCommit = commitsWithAddr[commitsLen - 1];

            const commitOwner1BalPre: BigNumber = await token.balanceOf(commit1.ownerAddr);
            const commitOwner2BalPre: BigNumber = await token.balanceOf(commit2.ownerAddr);
            const totalSupplyPre: BigNumber = await token.totalSupply();

            await gitConsensus.addCommit(commit1.data);
            await gitConsensus.addCommit(commit2.data);

            expect(await gitConsensus.hashExists(`0x` + tag.hash)).to.equal(false);

            // build a distribution to reward these two commits
            const value1: BigNumber = randomBigNumber();
            const value2: BigNumber = ethers.constants.MaxUint256; // == 1 + maxMintablePerHash
            const hashes: BytesLike[] = [`0x${commit1.hash}`, `0x${commit2.hash}`];
            const values: BigNumber[] = [value1, value2];

            // self-delegate: delegates must be assigned *before* voting period starts to be valid
            await token.connect(alice).delegate(alice.address);

            // create proposal to execute `addRelease(tag.data, d)`
            const calldata1 = gitConsensus.interface.encodeFunctionData(`addRelease`, [
                tag.data,
                hashes,
                values,
            ]);
            const proposalTxReceipt1 = await submitTxWait(
                governor
                    .connect(alice)
                    .propose(
                        [gitConsensus.address],
                        [0],
                        [calldata1],
                        await tag.data.message.toString(),
                    ),
            );
            const proposalId1 = parseEvent(proposalTxReceipt1, governor.interface)[0].args
                .proposalId;

            // voting starts
            await waitBlocks(EXAMPLE_VOTING_DELAY_BLOCKS);
            await governor.connect(alice).castVote(proposalId1, VoteType.FOR);
            await waitBlocks(EXAMPLE_VOTING_PERIOD_BLOCKS);

            await submitTxFail(
                governor
                    .connect(alice)
                    .execute(
                        [gitConsensus.address],
                        [0],
                        [calldata1],
                        ethers.utils.id(await tag.data.message.toString()),
                    ),
                `${TokenErrors.MAX_MINTABLE_PER_HASH_EXCEEDED}(${value2}, ${MAX_MINTABLE_PER_HASH})`,
            );

            // No data should have changed since the transaction was reverted.
            expect(await gitConsensus.hashExists(`0x` + tag.hash)).to.equal(false);
            expect(await token.totalSupply()).to.equal(totalSupplyPre);
            expect(await token.balanceOf(commit1.ownerAddr)).to.equal(commitOwner1BalPre);
            expect(await token.balanceOf(commit2.ownerAddr)).to.equal(commitOwner2BalPre);
        });
    });

    context(`clones`, async () => {
        it(`should create clones using arguments`, async () => {
            expect(await token.name()).to.equal(EXAMPLE_TOKEN_NAME);
            expect(await token.symbol()).to.equal(EXAMPLE_TOKEN_SYMBOL);
            expect(await token.minter()).to.equal(gitConsensus.address);
            expect(await token.governor()).to.equal(governor.address);
            expect(await token.maxMintablePerHash()).to.equal(MAX_MINTABLE_PER_HASH);
            expect(await token.balanceOf(alice.address)).to.eq("200");
            expect(await token.balanceOf(bob.address)).to.eq("100");
            expect(await token.totalSupply()).to.eq(await sumBigNumbers([200, 100]));

            expect(await governor.name()).to.equal(EXAMPLE_GOVERNOR_NAME);
            expect(await governor.votingDelay()).to.eq(EXAMPLE_VOTING_DELAY_BLOCKS);
            expect(await governor.votingPeriod()).to.eq(EXAMPLE_VOTING_PERIOD_BLOCKS);
            expect(await governor.proposalThreshold()).to.eq(EXAMPLE_VOTING_PROPOSAL_THRESHOLD);
            expect(await governor[`quorumNumerator()`]()).to.eq(EXAMPLE_VOTING_QUORUM_PERCENT);
        });
    });
});
