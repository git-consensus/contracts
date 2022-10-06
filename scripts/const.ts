// This file contains most of the information a caller would need to know about contract interaction responses,
// as well as constants that get re-used in deployment and test files.

export const ZERO_ADDRESS = `0x0000000000000000000000000000000000000000`;
export const ZERO_HASH = `0x0000000000000000000000000000000000000000000000000000000000000000`;

// These some random params to make for the github.com/git-consensus/example onboarding with
// a new Token and Governor clone. Uses standard naming conventions for them.

// --- Token Clone params --

export const EXAMPLE_TOKEN_NAME = `ExampleToken`;
export const EXAMPLE_TOKEN_SYMBOL = `EXT`;

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
    SUBSTRING_OUT_OF_BOUNDS = `SubstringOutOfBounds`,
}

export enum TokenErrors {
    INITIAL_DISTRIBUTION_LENGTH_MISMATCH = `InitialDistributionLengthMismatch`,
    UNAUTHORIZED_MINTER = `UnauthorizedMinter`,
    MAX_MINTABLE_PER_HASH_EXCEEDED = `MaxMintablePerHashExceeded`,
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
