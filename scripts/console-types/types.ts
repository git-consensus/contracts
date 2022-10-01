// Types used in console.ts

type DeploymentContract = {
    name: string;
    address: string;
};

type Deployment = {
    network: string;
    contracts: Array<DeploymentContract>;
};

type Deployments = {
    deployments: Array<Deployment>;
};

enum Usage {
    CONTRIBUTOR = `CONTRIBUTOR - add or check a git commit/tag on-chain, Token interactions, or Governor interactions.`,
    MAINTAINER = `MAINTAINER - onboard a project to Git Consensus Protocol.`,
    DEV = `DEV - re-deploy GitConsensus, TokenFactory, or GovernorFactory contracts.`,
}

enum ContributorAction {
    CONTRIBUTOR_COMMIT_CHECK = `check a git commit`,
    CONTRIBUTOR_COMMIT_ADD = `add a git commit`,
    CONTRIBUTOR_TAG_CHECK = `check a git tag (verify a release)`,
    CONTRIBUTOR_TOKEN_BALANCE = `check voting power (token balance)`,
    CONTRIBUTOR_TOKEN_DELEGATE = `delegate voting power to another address`,
    CONTRIBUTOR_PROPOSE = `create a proposal`,
    CONTRIBUTOR_VOTE = `vote on an active proposal`,
    CONTRIBUTOR_EXECUTE = `execute a successful proposal (to add a release)`,
}

enum MaintainerActionContract {
    BOTH = `Token and Governor`,
    TOKEN = `Token only`,
    GOVERNOR = `Governor only`,
}

enum DevActionContract {
    GIT_CONSENSUS = `GitConsensus`,
    TOKEN_FACTORY = `TokenFactory`,
    GOVERNOR_FACTORY = `GovernorFactory`,
}

export {
    DeploymentContract,
    Deployment,
    Deployments,
    Usage,
    ContributorAction,
    MaintainerActionContract,
    DevActionContract,
};
