// Types used in console.ts

type DeploymentContract = {
    name: string,
    address: string,
}

type Deployment = {
    network: string,
    contracts: Array<DeploymentContract>,
}

type Deployments = {
    deployments: Array<Deployment>
}

enum DevContracts {
    GIT_CONSENSUS = `GitConsensus`,
    TOKEN_FACTORY = `TokenFactory`,
    GOVERNOR_FACTORY = `GovernorFactory`,
}

export {
    DeploymentContract,
    Deployment,
    Deployments,
    DevContracts
}