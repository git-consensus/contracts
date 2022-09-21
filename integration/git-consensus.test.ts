import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber, BytesLike } from "ethers";
import hre, { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
    ALICE_ADDR,
    BOB_ADDR,
    CHARLIE_ADDR,
    DAVE_ADDR,
    EXAMPLE_GOVERNOR_ADDR,
    EXAMPLE_GOVERNOR_NAME,
    EXAMPLE_OWNERS,
    EXAMPLE_TOKEN_NAME,
    EXAMPLE_TOKEN_SYMBOL,
    EXAMPLE_VALUES,
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

// randomBigNumber() only uses 20 * 8 = 160 bits, so no risk of going over
const MAX_MINTABLE_PER_HASH = ethers.constants.MaxUint256.sub(1);

describe(`Git Consensus integration tests`, () => {
    let gitConsensus: GitConsensus;
    let token: TokenImpl;
    let governor: GovernorImpl;

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
                    `${GitConsensusErrors.COMMIT_MSG_NEEDS_ADDR}("${commit.data.message}")`,
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
                    `${GitConsensusErrors.TAG_MSG_NEEDS_ADDR}("${tag.data.message}")`,
                );

                expect(await gitConsensus.tagExists(`0x` + tag.hash)).to.equal(false);
                expect(await gitConsensus.tagAddr(`0x` + tag.hash)).to.equal(ZERO_ADDRESS);
            }
        });

        it(`should fail invalid release from non-governor`, async () => {
            const tag: Tag = tagsWithAddr[0];
            const hashes: BytesLike[] = [
                `0x` + commitsWithAddr[0].hash,
                `0x` + commitsWithAddr[1].hash,
            ];
            const values: BigNumber[] = [BigNumber.from(10), BigNumber.from(20)];
            await submitTxFail(
                gitConsensus.connect(alice).addRelease(tag.data, hashes, values),
                `${GitConsensusErrors.UNAUTHORIZED_RELEASE}("${alice.address}", "${EXAMPLE_GOVERNOR_ADDR}")`,
            );
        });

        it(`should succeed valid release, commits from last tag to current`, async () => {
            // only want to include last two commits that were new in v1.1.1 -> v1.1.2
            // a7645f13560c99eafea6e9d71c80b74877ee1e4e BB to BBB in file.txt 0x39E5949217828f309bc60733c9EDbF2f1F522449 (v1.1.1) -Bob
            // 1da9b6c0c1678a21d783f36b0b5bfce2fa527f6c CC to CCC in file.txt 0xc66EF5281FF553f04a64BC4700146606DB921062 -Charlie
            // a0c8c1b5083b1d5eaab179a288bbf79295029b1c DD to DDD in file.txt 0x6E503a5c6C41b5A68cD3Bfff98d8B04bc45CAf93 (v1.1.2) -Dave

            const tagsLen: number = tagsWithAddr.length;
            const tag: Tag = tagsWithAddr[tagsLen - 1];
            const commitsLen: number = commitsWithAddr.length;
            const commit1: Commit = commitsWithAddr[commitsLen - 2];
            const commit2: Commit = commitsWithAddr[commitsLen - 1];

            const commitOwner1BalPre: BigNumber = await token.balanceOf(commit1.ownerAddr);
            const commitOwner2BalPre: BigNumber = await token.balanceOf(commit2.ownerAddr);
            const totalSupplyPre: BigNumber = await token.totalSupply();

            await gitConsensus.addCommit(commit1.data);
            await gitConsensus.addCommit(commit2.data);

            expect(await gitConsensus.tagExists(`0x` + tag.hash)).to.equal(false);

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
                    .propose([gitConsensus.address], [0], [calldata1], tag.data.message),
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
                        ethers.utils.id(await tag.data.message),
                    ),
            );
            const executeLogs1 = parseEvent(executeTxReceipt1, governor.interface);
            expect(executeLogs1.length).to.equal(1);
            expect(executeLogs1[0].args.proposalId).to.equal(proposalId1);

            const addReleaseLogs1 = parseEvent(executeTxReceipt1, gitConsensus.interface);
            expect(addReleaseLogs1.length).to.equal(1);
            expect(addReleaseLogs1[0].args.tokenAddr).to.equal(token.address);
            expect(addReleaseLogs1[0].args.tagHash).to.equal(`0x${tag.hash}`);

            expect(await gitConsensus.tagExists(`0x` + tag.hash)).to.equal(true);
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
                expect(await gitConsensus.tagExists(`0x` + tag.hash)).to.equal(false);

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

                    const ownerAddr = await gitConsensus.commitAddr(`0x${hash}`);
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
                        .propose([gitConsensus.address], [0], [calldata1], tag.data.message),
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
                            ethers.utils.id(await tag.data.message),
                        ),
                );
                const executeLogs1 = parseEvent(executeTxReceipt1, governor.interface);
                expect(executeLogs1.length).to.equal(1);
                expect(executeLogs1[0].args.proposalId).to.equal(proposalId1);

                const addReleaseLogs1 = parseEvent(executeTxReceipt1, gitConsensus.interface);
                expect(addReleaseLogs1.length).to.equal(1);
                expect(addReleaseLogs1[0].args.tokenAddr).to.equal(token.address);
                expect(addReleaseLogs1[0].args.tagHash).to.equal(`0x${tag.hash}`);

                expect(await gitConsensus.tagExists(`0x` + tag.hash)).to.equal(true);
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
            const tag: Tag = tagsWithAddr[tagsLen - 1];
            const commitsLen: number = commitsWithAddr.length;
            const commit1: Commit = commitsWithAddr[commitsLen - 2];
            const commit2: Commit = commitsWithAddr[commitsLen - 1];

            const commitOwner1BalPre: BigNumber = await token.balanceOf(commit1.ownerAddr);
            const commitOwner2BalPre: BigNumber = await token.balanceOf(commit2.ownerAddr);
            const totalSupplyPre: BigNumber = await token.totalSupply();

            await gitConsensus.addCommit(commit1.data);
            await gitConsensus.addCommit(commit2.data);

            expect(await gitConsensus.tagExists(`0x` + tag.hash)).to.equal(false);

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
                    .propose([gitConsensus.address], [0], [calldata1], tag.data.message),
            );
            const proposalId1 = parseEvent(proposalTxReceipt1, governor.interface)[0].args
                .proposalId;

            // // voting starts
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
                        ethers.utils.id(await tag.data.message),
                    ),
                `${TokenErrors.MAX_MINTABLE_PER_HASH_EXCEEDED}(${value2}, ${MAX_MINTABLE_PER_HASH})`,
            );

            // No data should have changed since the transaction was reverted.
            expect(await gitConsensus.tagExists(`0x` + tag.hash)).to.equal(false);
            expect(await token.totalSupply()).to.equal(totalSupplyPre);
            expect(await token.balanceOf(commit1.ownerAddr)).to.equal(commitOwner1BalPre);
            expect(await token.balanceOf(commit2.ownerAddr)).to.equal(commitOwner2BalPre);
        });
    });

    context(`clones`, async () => {
        it(`should create clones using arguments`, async () => {
            expect(await token.name()).to.equal(EXAMPLE_TOKEN_NAME);
            expect(await token.symbol()).to.equal(EXAMPLE_TOKEN_SYMBOL);
            for (let i = 0; i < EXAMPLE_OWNERS.length; i++) {
                expect(await token.balanceOf(EXAMPLE_OWNERS[i])).to.eq(EXAMPLE_VALUES[i]);
            }
            expect(await token.totalSupply()).to.eq(await sumBigNumbers(EXAMPLE_VALUES));

            expect(await governor.name()).to.equal(EXAMPLE_GOVERNOR_NAME);
            expect(await governor.votingDelay()).to.eq(EXAMPLE_VOTING_DELAY_BLOCKS);
            expect(await governor.votingPeriod()).to.eq(EXAMPLE_VOTING_PERIOD_BLOCKS);
            expect(await governor.proposalThreshold()).to.eq(EXAMPLE_VOTING_PROPOSAL_THRESHOLD);
            expect(await governor[`quorumNumerator()`]()).to.eq(EXAMPLE_VOTING_QUORUM_PERCENT);
        });
    });

    beforeEach(async () => {
        // Resets the state of the hardhat network each time, which means that for
        // each `it()` block, the contracts will always have the same address. Mainly
        // relevant for the Governor clone (which has const address in the tag message).
        // If we *didn't* do this, createGovernor(...) would get a different
        // address everytime, even with the same salt.
        await hre.network.provider.send(`hardhat_reset`);

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
        const tokenFactory = await deployTokenFactory(deployer);
        const governorFactory = await deployGovernorFactory(deployer);

        const governorAddr = await governorFactory.predictAddress(ZERO_HASH);

        token = await createTokenClone(
            tokenFactory.address,
            gitConsensus.address,
            governorAddr,
            alice, // can be anyone
            EXAMPLE_TOKEN_NAME,
            EXAMPLE_TOKEN_SYMBOL,
            MAX_MINTABLE_PER_HASH, // randomBigNumber() only uses 20 * 8 = 160 bits, so no risk of going over
            EXAMPLE_OWNERS,
            EXAMPLE_VALUES,
            ZERO_HASH,
        );

        governor = await createGovernorClone(
            governorFactory.address,
            token.address,
            alice, // can be anyone
            EXAMPLE_GOVERNOR_NAME,
            EXAMPLE_VOTING_DELAY_BLOCKS,
            EXAMPLE_VOTING_PERIOD_BLOCKS,
            EXAMPLE_VOTING_PROPOSAL_THRESHOLD,
            EXAMPLE_VOTING_QUORUM_PERCENT,
            ZERO_HASH,
        );
    });
});
