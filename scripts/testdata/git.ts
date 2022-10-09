import fs from "fs-extra";
import {
    Branch,
    Clone,
    CloneOptions,
    Commit,
    Cred,
    FetchOptions,
    Object,
    Oid,
    Reference,
    Remote,
    Repository,
    Revwalk,
    Tag,
} from "nodegit";

import { homedir } from "os";
import path from "path";
import { ZERO_ADDRESS } from "..";

// Problems running nodegit?
// Try this: 'apt-get install -y python2 python3 libkrb5-dev gcc openssl libssh2-1-dev libcurl4-openssl-dev g++ make'

export async function cloneRepo(
    remote: string,
    localPath: string,
    branchName?: string,
): Promise<Repository> {
    // local dir needs to be empty
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    fs.emptyDirSync(localPath);

    if (branchName === undefined) branchName = `master`;

    const fetchOpts: FetchOptions = {
        downloadTags: Remote.AUTOTAG_OPTION.DOWNLOAD_TAGS_NONE,
        callbacks: { credentials: getCredentials() },
    };
    const cloneOpts: CloneOptions = {
        checkoutBranch: branchName,
        fetchOpts: fetchOpts,
    };

    let repo: Repository;
    try {
        repo = await Clone.clone(remote, localPath, cloneOpts);
    } catch (err) {
        console.error(`failed to clone ${remote} into ${localPath}, error: ${err}`);
        return Promise.reject(err);
    }

    return repo;
}

export async function getCommits(_repo: Repository | string, count?: number): Promise<Commit[]> {
    const repo: Repository = _repo instanceof Repository ? _repo : await Repository.open(_repo);
    const lastCommit: Commit = await repo.getHeadCommit();

    const revWalk: Revwalk = repo.createRevWalk();
    revWalk.sorting(Revwalk.SORT.TIME);
    revWalk.push(lastCommit.id());

    if (typeof count === `undefined`) return revWalk.getCommitsUntil(() => true); // return all commit
    return revWalk.getCommits(count);
}

export async function getTags(_repo: Repository): Promise<Tag[]> {
    const repo: Repository = _repo instanceof Repository ? _repo : await Repository.open(_repo);
    const tagNames: Tag[] = (await Tag.list(repo)) as Tag[];

    const tags: Tag[] = [];
    for (const tagName of tagNames) {
        const tag: Tag = await repo.getTagByName(tagName.toString());
        tags.push(tag);
    }
    return tags;
}

export async function injectCommitAddress(
    repo: Repository,
    aliceAddr: string,
    bobAddr: string,
    charlieAddr: string,
    daveAddr: string,
    branchName: string = `master`,
): Promise<Oid[]> {
    const branchRef = await Branch.lookup(repo, branchName, Branch.BRANCH.LOCAL);

    const oldCommits = await getCommits(repo);
    const commitIds: Oid[] = [];
    let prevCommit: Commit | undefined = undefined; // make parent of next commit
    for (let i = oldCommits.length - 1; i >= 0; i--) {
        let addr: string = ZERO_ADDRESS;
        switch (oldCommits[i].author().name()) {
            case `Alice`:
                addr = aliceAddr;
                break;
            case `Bob`:
                addr = bobAddr;
                break;
            case `Charlie`:
                addr = charlieAddr;
                break;
            case `Dave`:
                addr = daveAddr;
                break;
        }
        const message = `commit #${oldCommits.length - i}, msg with embedded address ${addr}`;

        const parents: Oid[] = [];
        if (prevCommit !== undefined) {
            parents.push(prevCommit?.id());
        }

        const commitId = await repo.createCommit(
            branchRef as unknown as string,
            oldCommits[i].author(),
            oldCommits[i].committer(),
            message,
            await oldCommits[i].getTree(),
            parents,
        );
        commitIds.push(commitId);

        prevCommit = await Commit.lookup(repo, commitId);
    }

    // set branch to point to new HEAD
    if (prevCommit !== undefined) {
        await branchRef.setTarget(prevCommit.id(), `ffwd merge`);
    }

    return commitIds;
}

export async function injectTagAddress(
    repo: Repository,
    tokenAddr: string,
    tagInterval: number = 3,
): Promise<Oid[]> {
    // clean up old tags if any exist
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    fs.emptyDirSync(`${repo.path()}/refs/tags/`);

    const commits = await getCommits(repo);
    let tagCount = 1;
    const tagIds: Oid[] = [];
    for (let i = commits.length - 1; i >= 0; i--) {
        if (i % tagInterval !== 0) {
            continue;
        }
        const object = await Object.lookup(repo, commits[i].id(), Object.TYPE.COMMIT);
        const message = `v0.0.${tagCount}, msg with embedded address ${tokenAddr}, time=${commits[
            i
        ].time()}`;
        const tagId = await Tag.annotationCreate(
            repo,
            `v0.0.${tagCount}`,
            object,
            commits[i].author(),
            message,
        );
        tagIds.push(tagId);

        // actually add the new tag to the repo
        await Reference.create(
            repo,
            `refs/tags/v0.0.${tagCount}`,
            tagId,
            1,
            `created tag v0.0.${tagCount}`,
        );

        tagCount++;
    }

    return tagIds;
}

function getCredentials(): (_url: string, userName: string) => Cred {
    let debug = 0;
    return (_url: string, userName: string) => {
        if (debug++ > 10) {
            return Cred.sshKeyNew(
                userName,
                path.resolve(homedir(), `.ssh/id_rsa.pub`),
                path.resolve(homedir(), `.ssh/id_rsa`),
                ``,
            );
        }
        return Cred.sshKeyFromAgent(userName);
    };
}
