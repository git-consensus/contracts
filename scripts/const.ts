// This file contains most of the information a caller would need to know about contract interaction responses,
// as well as constants that get re-used in deployment and test files.

export const ZERO_ADDRESS = `0x0000000000000000000000000000000000000000`;
export const ZERO_HASH = `0x0000000000000000000000000000000000000000000000000000000000000000`;

export const EXAMPLE_TOKEN_ADDR = `0x1249723FA3B0Adb68D7873fD611691e7B6fBD081`;

// These should always be ethers.getSigners()[1],[2],[3],[4] on hardhat network.
export const ALICE_ADDR = `0xf304255aF88d457Ba221525F3C36188016AFE08E`;
export const BOB_ADDR = `0x39E5949217828f309bc60733c9EDbF2f1F522449`;
export const CHARLIE_ADDR = `0xc66EF5281FF553f04a64BC4700146606DB921062`;
export const DAVE_ADDR = `0x6E503a5c6C41b5A68cD3Bfff98d8B04bc45CAf93`;

// used for giving Alice and Bob initial ownership distribution
export const EXAMPLE_OWNERS = [ALICE_ADDR, BOB_ADDR];
export const EXAMPLE_VALUES = [100, 50];

/// --- ERRORS ---

export enum GitConsensusErrors {
    COMMIT_MSG_NEEDS_ADDR = `CommitMsgNeedsAddr`,
    TAG_MSG_NEEDS_ADDR = `TagMsgNeedsAddr`,
    DISTRIBUTION_LENGTH_MISMATCH = `DistributionLengthMismatch`,
    UNAUTHORIZED_RELEASE = `UnauthorizedRelease`,
}
