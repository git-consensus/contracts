// This file contains most of the information a caller would need to know about contract interaction responses,
// as well as constants that get re-used in deployment and test files.

export const ZERO_ADDRESS = `0x0000000000000000000000000000000000000000`;
export const ZERO_HASH = `0x0000000000000000000000000000000000000000000000000000000000000000`;

// The first token & governor clones' addresses when submitting with ZERO_HASH as salt,
// so this example repo made with this expectation. This is what is embedded in the tag
// messages, so if this differs, test will break.
export const EXAMPLE_TOKEN_ADDR = `0x1249723FA3B0Adb68D7873fD611691e7B6fBD081`;
export const EXAMPLE_GOVERNOR_ADDR = `0x037A59f34F776a84a2e7507f0F978e7444b4bf5A`;

// These should always be ethers.getSigners()[1],[2],[3],[4] on hardhat network.
export const ALICE_ADDR = `0xf304255aF88d457Ba221525F3C36188016AFE08E`;
export const BOB_ADDR = `0x39E5949217828f309bc60733c9EDbF2f1F522449`;
export const CHARLIE_ADDR = `0xc66EF5281FF553f04a64BC4700146606DB921062`;
export const DAVE_ADDR = `0x6E503a5c6C41b5A68cD3Bfff98d8B04bc45CAf93`;

// These some random params to make for the github.com/git-consensus/example onboarding with
// a new Token and Governor clone. Uses standard naming conventions for them.

// --- Token Clone params --

export const EXAMPLE_TOKEN_NAME = `ExampleToken`;
export const EXAMPLE_TOKEN_SYMBOL = `EXT`;
// used for giving Alice and Bob initial ownership distribution
export const EXAMPLE_OWNERS = [ALICE_ADDR, BOB_ADDR];
export const EXAMPLE_VALUES = [200, 100];

// --- Governor Clone params --
export const EXAMPLE_GOVERNOR_NAME = `ExampleGovernor`;
// delay for voting to start on new proposal
export const EXAMPLE_VOTING_DELAY_BLOCKS = 1;
// length of time for voting to occur before proposal is considered passed or failed
export const EXAMPLE_VOTING_PERIOD_BLOCKS = 100800; // 2 weeks (if 12s per block)
// number of votes an account needs to make a proposal, keep 0 for allowing any proposal
// but in a real case this may allow malicious actors to spam proposals.
export const EXAMPLE_VOTING_PROPOSAL_THRESHOLD = 0;
// % of 'FOR' votes out of total supply required for proposal to succeed.
export const EXAMPLE_VOTING_QUORUM_PERCENT = 5; // 5%

/// --- ERRORS ---

export enum GitConsensusErrors {
    COMMIT_MSG_NEEDS_ADDR = `CommitMsgNeedsAddr`,
    TAG_MSG_NEEDS_ADDR = `TagMsgNeedsAddr`,
    DISTRIBUTION_LENGTH_MISMATCH = `DistributionLengthMismatch`,
    UNAUTHORIZED_RELEASE = `UnauthorizedRelease`,
}

/// --- GOVERNOR TYPES ---

export enum VoteType {
    AGAINST = 0,
    FOR = 1,
    ABSTAIN = 2,
}

export enum ProposalState {
    PENDING = `Pending`,
    ACTIVE = `Active`,
    CANCELED = `Canceled`,
    DEFEATED = `Defeated`,
    SUCCEEDED = `Succeeded`,
    QUEUED = `Queued`,
    EXPIRED = `Expired`,
    EXECUTED = `Executed`,
}
