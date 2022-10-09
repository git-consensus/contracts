import { BytesLike } from "ethers";
import fs from "fs-extra";
import { Commit, Repository, Tag } from "nodegit";
import { TESTDATA_LOCAL_PATH } from "../../hardhat.config";
import { IGitConsensusTypes } from "../../types/contracts/interfaces/IGitConsensus.sol/IGitConsensus";
import { parseAddr } from "../utils";
import { getCommits, getTags } from "./git";

// =================================================================================================
// =============================== example repository commits/tags =================================
// =================================================================================================
//
// This example can also be viewed live on Github:
// commits: https://github.com/git-consensus/example/commits/master
// tags: https://github.com/git-consensus/example/tags
//
// Represents a repo that onboarded to Git Consensus mid-way through the lifetime of their repository
// and contains:
// - 15 commits (3 pre-onboard with no address, 12 post-onboard with address)
// - 7 tags (2 pre-onboard with no address, 5 post-onboard with address)
// each of which are authored and signed with GPG keys from 4 different users:
// Alice and Bob (who act as "existing" maintainers before onboard)
// Charlie and Dave (who joined after onboard)
//
// these can be found with 'git log --oneline --no-abbrev-commit' on the repo example
// full info for each commit & tag can be found at the bottom of this file
//
// commit format:
// `hash "message" (tag name) -signer`
// ---------------------------------
// 4a6c87c8f1f89dae50339e315dee0a2d7a0e6796 add file.txt (v0.1.0) -Alice
// 5f288b6e0791d3b001d4e02871c0db4a7f0ae67b add config.yaml -Bob
// 0716f9facad1b33b0a994d97658e63c00a0cacfd delete config.yaml (v0.1.1) -Alice
// 0cd3c6a3887a47b21e1efa61e524d2cc98defb90 add A to file.txt 0xf304255aF88d457Ba221525F3C36188016AFE08E -Alice
// 618dfb41eb263ed5cc1a6a9ec5c9f8fe8c61947c add B to file.txt 0x39E5949217828f309bc60733c9EDbF2f1F522449 (v1.0.0) -Bob
// 69bc539313e2aa84b0c2d166c5aec2572a4a24f1 add C to file.txt 0xc66EF5281FF553f04a64BC4700146606DB921062 -Charlie
// 9b42169c9efe329489b74984ef7250bfa0a9681c add D to file.txt 0x6E503a5c6C41b5A68cD3Bfff98d8B04bc45CAf93 (v1.0.1) -Dave
// 2ca0e4bd904c69a38cbe3d2d4bccd7fd87876cde A to AA in file.txt 0xf304255aF88d457Ba221525F3C36188016AFE08E -Alice
// b9e3a66b06076df455d251115147a130458dcef2 B to BB in file.txt 0x39E5949217828f309bc60733c9EDbF2f1F522449 -Bob
// d9bfa3300bc651766755acd8087454e4d8fe99b0 C to CC in file.txt 0xc66EF5281FF553f04a64BC4700146606DB921062 -Charlie
// babbe3755b4ce7cdb6572495156d401d69347b16 D to DD in file.txt 0x6E503a5c6C41b5A68cD3Bfff98d8B04bc45CAf93 (v1.1.0) -Dave
// 9a0a5864111737dcf0dee757997f8b82a53e29f2 AA to AAA in file.txt 0xf304255aF88d457Ba221525F3C36188016AFE08E -Alice
// a7645f13560c99eafea6e9d71c80b74877ee1e4e BB to BBB in file.txt 0x39E5949217828f309bc60733c9EDbF2f1F522449 -Bob
// 1da9b6c0c1678a21d783f36b0b5bfce2fa527f6c CC to CCC in file.txt 0xc66EF5281FF553f04a64BC4700146606DB921062 -Charlie
// a0c8c1b5083b1d5eaab179a288bbf79295029b1c DD to DDD in file.txt 0x6E503a5c6C41b5A68cD3Bfff98d8B04bc45CAf93 (v1.1.1) -Dave

// annotated tag format:
// `hash (tag name) "message" -signer`
// ---------------------------------
// 66a50fe1ddad5f812836e942a7200392c5311d93 (v0.1.0) "first tag" -Alice
// 765094f73f8d6a9821bc55cef346ecf0899dac7a (v0.1.1) "second tag" -Bob
// 353f2824d02cf7730cd7c31c92ab91ff772af0c5 (v1.0.0) "third tag 0x1249723FA3B0Adb68D7873fD611691e7B6fBD081" -Alice
// a08b408e1659c75161086305a54da5f96f0d6658 (v1.0.1) "fourth tag 0x1249723FA3B0Adb68D7873fD611691e7B6fBD081" -Bob
// d7815c9f7ef87b1d746e8ea11f652933ba1a8cb6 (v1.1.0) "fifth tag 0x1249723FA3B0Adb68D7873fD611691e7B6fBD081" -Charlie
// 8fccc24d51545cc9d1fca5f3c8e4e6b42c41bafb (v1.1.1) "sixth tag 0x1249723FA3B0Adb68D7873fD611691e7B6fBD081" -Alice

export type TestCommit = {
    // @param hash The expected SHA hash from the data (for comparing contract state in tests).
    hash: BytesLike;
    // @param address The address of the signer who will recieve rewards (for comparing to contract state in tests).
    // This should be equivalent to the address embedded in the data.message.
    ownerAddr: string;
    // @param data The commit tree, parents, author, message, etc.
    data: IGitConsensusTypes.CommitDataStruct;
};

export type TestTag = {
    // @param hash The expected SHA hash from the data (for comparing in tests).
    hash: BytesLike;
    // @param address The address of the token contract.
    // This should be equivalent to the address embedded in the data.message.
    tokenAddr: string;
    // @param data The tag name, commit hash, author, message, etc.
    data: IGitConsensusTypes.TagDataStruct;
};

// --- HERE BE DRAGONS ---

// Any deviations to these sigs will cause a different SHA1 hash (including
// silly things like whitespace or indents in your backtick'd strings).
//
// For example, why do we need to do
//      `signature.split("\n").join("\n ") + "\n"`
// on commits but not tags? Because git does it this way, thats why.
// Same thing with why message now comes before the sig, or why the sig is
// now prefixed with "gpgsig " in tags.

// Simulates some example commits in a git repo that DON'T have a compatible commits
// for receiving a token, the commit message does not have an ethereum address.
export function commitExamplesNoAddr(): TestCommit[] {
    const commits: TestCommit[] = [];

    // c1
    commits.push({
        hash: `4a6c87c8f1f89dae50339e315dee0a2d7a0e6796`,
        ownerAddr: ``,
        data: {
            tree: `tree bdd68b0120ca91384c1606468b4ca81b8f67c728\n`,
            parents: `\n`,
            author: `author Alice <alice@foo.com> 1662172111 -0700\n`,
            committer: `committer Alice <alice@foo.com> 1662172111 -0700\n`,
            message: `\nadd file.txt\n`,
            signature:
                `gpgsig -----BEGIN PGP SIGNATURE-----

iQJCBAABCAAsFiEEtvSefVgeKuej5CJ5PCZ+3Ki05mAFAmMSu+IOHGFsaWNlQGZv
by5jb20ACgkQPCZ+3Ki05mCntg/+KwUzHopg1Qeh9j1+t1HgMclX4k1icMTnNLL1
0MXtN+OBVU2fLCaH+5sf2t1Pft7Nv1iqj12w3aMbWOn5j+21w7dx+mMbIlRbtslw
t5+ZZr6ERstYXopqzp2XQoScPm6Y6ItUJ7bQs4NdMkcKlRSl9P6BuKiBheQfiR05
2Cw8cQNyswhGrfeoP8946d/zz36tvvZVG7pWoSspEWa6hFLLPDuUDVscb+bZP83e
3SXAqnV0rYwkupho4u+DXQj5dKyLi3JF3c4vej73KT7EmPlESyKJ4d9F9vXRLbvQ
MvY6eSPzxd+pXWFGee0DOHjkJtylbmO+6CtfSu/PpWLI4O1ikBvidDEZnoA0rfVS
UHVFkl123lFvwQ9GsW2+xCnumhViYtTf2iyzEeIbfFmp7lNd18HLkEMuv4oEXJVl
LQoTPsdbxhCBjFAeD/Hha8TFQPV4JhGhw63oocQoFecHYWOcef/6lTopyj7dxZWX
aSU0v+t/F7Z7Pod6qXV9uyXjojcP9RVKScD9z9JzWh0Uoq7aoRmSHyDEZK5rjiL1
Xh6wwOj6x3qNjximGr54qNVvBGZupY+kQ+72U4gxlCj//nO9tsd+qEOtNgM66/zC
NQK5gbqLdSr0O5eCOKiIdYYVH+iSn6iQphdoci8PGK6vxiG4G+lfSl7M/av9awkw
qhrdeuM=
=AJPz
-----END PGP SIGNATURE-----`
                    .split(`\n`)
                    .join(`\n `) + `\n`,
        },
    });

    // c2
    commits.push({
        hash: `5f288b6e0791d3b001d4e02871c0db4a7f0ae67b`,
        ownerAddr: ``,
        data: {
            tree: `tree 04cf2f313ba4201d140c580f9763924b35af5559\n`,
            parents: `parent 4a6c87c8f1f89dae50339e315dee0a2d7a0e6796\n`,
            author: `author Bob <bob@bar.org> 1662172345 -0700\n`,
            committer: `committer Bob <bob@bar.org> 1662172345 -0700\n`,
            message: `\nadd config.yaml\n`,
            signature:
                `gpgsig -----BEGIN PGP SIGNATURE-----

iQJABAABCAAqFiEEJNIYprrwxY2aoNuPD6jL/IzapAoFAmMSvL0MHGJvYkBiYXIu
b3JnAAoJEA+oy/yM2qQKq9wQAMWEMZYue8wieZ1Nz00S1fW3ruWycCvstgsF5zKj
ba4D6gXoabNsnnhq0asMOSxF6nwNrGBMYTbUtKajF8Wgq9QITkvyOdixzBHP4lnq
JzAXDbSve4jMvljgpQQLIU7ribNhwAGrPMF9yrILMSdYC3yTu1g1txT39Yf7g2eq
q9wKlHrpi3y4riCkA9G85tMRXm8PoYZqElHBpziFNJD+PEpUlAMc0xcwEqBlLE9H
PtucdGF3OfcoHkhWtbu9WPTz2wcmAOYiyziLc4aKG9a7lARbL5ko1HZHUjp3KtAk
JoR6FmRu9O30Ym9v0mYUJc5j0A0FuhwUTPC9Jb53PKcI2RwA2Ym5CEqf0+9yXjVd
RqbrV+unUuu0VQ0b4aZklZ2aGAJMfvFeVB6WbLBSBsQ3JzrsETWqto21at0PpStj
liR5izU+mTaoicPDZubV5Gi0lyH8w7r5IadjU3VjHAN6nJ8A4C1QOHh2cC/Cy4Ra
jvHwf7ab58WUcMrJFA4tlgqHihbBNnO1I++3w0DGez/Icw+ZXNnwtxzuGPtFBH8p
MSD7VlGZW1LhX9uNYm4TSBFNLhKPwVO3hTLeaeJJQzoImso3PGB+V75lCEflE/8g
zIVk/WrUvk9iMrj0B1eU+Y0sTCIMDAVVxYU3UlAXpzjhmymaJJ6jz0dTOL/84K0/
HUy2
=vEEF
-----END PGP SIGNATURE-----`
                    .split(`\n`)
                    .join(`\n `) + `\n`,
        },
    });

    // c3
    commits.push({
        hash: `0716f9facad1b33b0a994d97658e63c00a0cacfd`,
        ownerAddr: ``,
        data: {
            tree: `tree 04cf2f313ba4201d140c580f9763924b35af5559\n`,
            parents: `parent 5f6b7c8d9ea9abe0b1c2d3e4f5f6a7b8c9d0e1f2\n`,
            author: `author Alice <alice@foo.com> 1662172428 -0700\n`,
            committer: `committer Alice <alice@foo.com> 1662172428 -0700\n`,
            message: `\ndelete config.yaml\n`,
            signature:
                `gpgsig -----BEGIN PGP SIGNATURE-----

iQJCBAABCAAsFiEEtvSefVgeKuej5CJ5PCZ+3Ki05mAFAmMSvQ8OHGFsaWNlQGZv
by5jb20ACgkQPCZ+3Ki05mCjjg/+Nhz+m9T6BL9bLWANWsecFTSlfbe9biWvrVK3
GaozDzg0fJePmaIIEfjeknUiJo56hYfknKuNEQBYWyRHktJhoKlYwdY9c3bSRC7f
L3nVQ/9c+hU1Qp6JxxYvjALhq+ALRt2Wvm8ZBhOeH3abn1RSqbKSConQ5F9l4mZ4
GK3RXFXix9Ox17whbqj2shYbEA3hijgDRLhXhKXyuxcgVZ0ZSNXn38BQ9xdsTqY6
UeC6tRvG91MP/wpI3/Yg0O37NIsf9p5ugYFs7vHC7gH1g+Xh0mh0GgjGyK2bzNX3
ay57YIBPVc46DALjMmPIOUBu6OI5ektYP4x6j3/5YMnrWiJJ5LVqUuBAn7Cjr/H2
KlPluPhvMyVFlsD3/yc5wGSHKWUvOxN0XBS4dARaXkIU5ioRWE1cyzKFo4gnYY3p
XPJbuCmnd1YIW04ioEl0CCnODaw24/0N1R7yQ//123Pdqot3JluUeyFWek0yhleb
KCiQ2HuzDKUx3zojAxj6sPvfg/cyQAMGCl9oqrDasISHd4nmHLAsoGyknolZty1/
81tczG8qZlr+T9dBBA58SS7IcKtRHVm/IRF9+BHQCHIDaAnlwd47NUPoalyo2UUJ
Wsc4RJK+Rdv0D4gy9D256grnc2vC0Jh/fu4+JlY1bl87QifDS+c8ZJXqcDOzkvSx
StIDmUE=
=oSzH
-----END PGP SIGNATURE-----`
                    .split(`\n`)
                    .join(`\n `) + `\n`,
        },
    });

    return commits;
}

// Simulates some example commits in a git repo that DO have a compatible commits
export async function commitExamplesWithAddr(
    localPath: string = TESTDATA_LOCAL_PATH,
): Promise<TestCommit[]> {
    let repo: Repository;
    if (!(await fs.pathExists(localPath))) {
        return Promise.reject(`Test data not found at ${localPath}`);
    } else {
        repo = await Repository.open(localPath);
    }

    const commits: Commit[] = await getCommits(repo);
    const testCommits: TestCommit[] = nodegitCommitsToTestCommits(commits);

    return testCommits;
}

// Simulates some example tags in a git repo that DON'T have a compatible tags,
// since it is a requirement that the tag messages have an associated token address
// to call `addRelease()`.
export function tagExamplesNoAddr(): TestTag[] {
    const tags: TestTag[] = [];

    // t1
    tags.push({
        hash: `66a50fe1ddad5f812836e942a7200392c5311d93`,
        tokenAddr: ``,
        data: {
            object: `object 4a6c87c8f1f89dae50339e315dee0a2d7a0e6796\n`,
            tagType: `type commit\n`,
            tagName: `tag v0.1.0\n`,
            tagger: `tagger Alice <alice@foo.com> 1662327756 -0700\n`,
            message: `\nfirst tag\n\n`,
            signature:
                `-----BEGIN PGP SIGNATURE-----

iQJCBAABCAAsFiEEtvSefVgeKuej5CJ5PCZ+3Ki05mAFAmMVG8wOHGFsaWNlQGZv
by5jb20ACgkQPCZ+3Ki05mCOcA//YUK5BEIoJ+dbdTeqWbXt/Sa66/qBaMQJWS81
llrAaDh3CB4IWadnnl+26qFktYvI5qHNxRmBpZAPAwUGGun0PPIZyvyX4twfoxu0
uwUiIEYJxT5e89HfBBhBwpTP61+a97teq4S9D1HU2K8k1h4JVyIqMczsSzGnvS6f
2II21c7XVLjKG6KKcnkHviLBKZHuH+D7pTp8iDaYw0YVZI8+afreRvK66sTXueD/
VDK0O1/0agU78OD1AIvepc7M0NSubww8hSCxbkujcckZjBUR/Fnvy2XWTgvKfN9e
Bs9b74BD4C3pGuBbYfIM20fdT0Vo8766ZhychiwZ8SEDsURRoIIRQoO0bDE623de
+QZxHJRCNwoliaiKW3vGqCYowXQ6Sl+sQHBDMKIzBwLDmmOBEhLyr2iktoVbclOh
fR1FcS4OcDhqOIAyKNY/ldFdV1Y9KA5YNyLJIvgUnWSxD6L3M9wOGRuX3p2chbLT
vcyFDZ0MwGUlRsPTb/qbUuqD4cGq5iFdumZSS9haFvbqmXF0mjeJ/FNjBxnazrSn
jQM8jPbNjXo4p8R63bU62kQyyNFNmIgHyXY7Fgllon4SGtPrMEHeKGFKbO2jlrqL
oRHVkKIqFwWcEYk16XpbrCZlNVuYx4NvOtHUFxxuhVog3IiTLSV2Xq0N3Xfq7DSD
gEez+Dg=
=XtCK
-----END PGP SIGNATURE-----` + `\n`,
        },
    });

    // t2
    tags.push({
        hash: `765094f73f8d6a9821bc55cef346ecf0899dac7a`,
        tokenAddr: ``,
        data: {
            object: `object 0716f9facad1b33b0a994d97658e63c00a0cacfd\n`,
            tagType: `type commit\n`,
            tagName: `tag v0.1.1\n`,
            tagger: `tagger Bob <bob@bar.org> 1662327806 -0700\n`,
            message: `\nsecond tag\n\n`,
            signature:
                `-----BEGIN PGP SIGNATURE-----

iQJABAABCAAqFiEEJNIYprrwxY2aoNuPD6jL/IzapAoFAmMVG/4MHGJvYkBiYXIu
b3JnAAoJEA+oy/yM2qQK8nIP/0PKYa1wsBKmXK0Ta2HItgYDPug1NH6kjcoIyEmR
icSH86xPi0D9CWkWUT3i7879BqktQl80V+aLIynmpG01gcIv0tKZI8TvH0KTS7VM
ZkqFqopZ7K+tbR40l48Ekmbyg+smiw3jGg7tkTlXGoaD8HDF68m5LKhK75gSI4Q4
KckChSg/dOy6oGNFAe8JOSWak6r4NWZANH2lPRz+nSqRRKfPYUF5bwA2SGUyU1sV
SnpnJMlzqL7y7Y5jZ0955dCJtQM5SZ+LEujC3aHz6SAEJN1dhaKwrNowgUxSHek5
D4LlsOIKMZCv7W74EEMpKykAYqsWR9GkdjnTb9I9lHLizDNWZOoJGquICqen/o8O
l5+eOBHJ7yYMrwQPS8mABjKZB7wj0HyMJoBWOW4DqvgByHwYxvP+S8YrX2IEqn3i
n7I3u0/MvwPfjpyX5TbQUo7+RloEiyXaYbUVRodzVHbS1LOmH3zJEL+dJ0SWDKsd
br0DCcxunQ03r9ZpmT4acoe3NzFrHiDeM6o8zjTDJYuUo8vKyBEFLpHF+D8W1Add
A2oSOcB5VLWAIFs2Ta6LMHc4LwWwVGF7kPFcI2utdMNfPxP7z0pTVixr77CytEyo
tedHRQrqWyNsV/xjh/6DBGcGJdAWtZSCNb1oH8vsOWS2NMpdZnUbZIbQB1l7caFA
j288
=yb3Z
-----END PGP SIGNATURE-----` + `\n`,
        },
    });

    return tags;
}

// Simulates some example tags in a git repo that DO have compatible tags.
export async function tagExamplesWithAddr(
    localPath: string = TESTDATA_LOCAL_PATH,
): Promise<TestTag[]> {
    let repo: Repository;
    if (!(await fs.pathExists(localPath))) {
        return Promise.reject(`Test data not found at ${localPath}`);
    } else {
        repo = await Repository.open(localPath);
    }

    const tags: Tag[] = await getTags(repo);
    const testTags: TestTag[] = nodegitTagsToTestTags(tags);

    return testTags;
}

function nodegitCommitsToTestCommits(commits: Commit[]): TestCommit[] {
    const testCommits: TestCommit[] = [];

    for (const commit of commits) {
        let parentStr = ``;
        if (commit.parents()[0] !== undefined) {
            parentStr = `parent ${commit.parents()[0]}\n`;
        }
        const testCommit = {
            hash: commit.sha(),
            ownerAddr: parseAddr(commit.message()),
            data: {
                tree: `tree ${commit.treeId()}\n`,
                parents: parentStr,
                author: `author ${commit.author().toString()} ${commit.time()} -0700\n`, // commit.timeOffset() is wrong
                committer: `committer ${commit.committer().toString()} ${commit.time()} -0700\n`,
                message: `\n${commit.message().toString()}`,
                signature: ``, // we lose gpgsig when re-creating via nodegit
            },
        };

        testCommits.push(testCommit);
    }
    return testCommits;
}

function nodegitTagsToTestTags(tags: Tag[]): TestTag[] {
    const testTags: TestTag[] = [];

    for (const tag of tags) {
        const testTag = {
            hash: tag.id().tostrS(),
            tokenAddr: parseAddr(tag.message()),
            data: {
                object: `object ${tag.targetId()}\n`,
                tagType: `type commit\n`,
                tagName: `tag ${tag.name().toString()}\n`,
                tagger: `tagger ${tag.tagger().toString()} ${parseTagTime(
                    tag.message().toString(),
                )} -0700\n`,
                message: `\n${tag.message().toString()}`,
                signature: ``, // we lose gpgsig when re-creating via nodegit
            },
        };

        testTags.push(testTag);
    }
    return testTags;
}

// NodeGit is not able to retrieve tag time, so we embed it and retrieve it in the message
function parseTagTime(str: string): string {
    return str.substring(str.indexOf(`time=`) + 5);
}

// --- COMMITS ---

// Full example repo commit data, can be found by running this in example repo
// to iterate through each commit and show the commit info for each one:
//
//      for commit in $(git rev-list master); do
//          echo $(git cat-file -p $commit)
//      done
//
// #############################################################
// c15 - a0c8c1b5083b1d5eaab179a288bbf79295029b1c
// #############################################################
// tree 707e4ab89edcfef3e916582617e40289c3e6ee9d
// parent 1da9b6c0c1678a21d783f36b0b5bfce2fa527f6c
// author Dave <dave@example.edu> 1662228138 -0700
// committer Dave <dave@example.edu> 1662228138 -0700
// gpgsig -----BEGIN PGP SIGNATURE----- iQJFBAABCAAvFiEEy925xuY0ejxNZy074yB0cge4QM8FAmMTlq0RHGRhdmVAZXhh bXBsZS5lZHUACgkQ4yB0cge4QM/gSxAAkhheisyJoQGWoW2RDCMO2X4BM3nbUpnG G0ijfViF9ZediqAesZLoJzWEp8nI7OSkKXzhVlqn0wm9toNT5M/aMBLb6t/k0Wj4 zX7Wvo0KsqZyGJPkbNbW3dc+zlrF61XBW+RNjLxLdPqKiu7jzv/ztMgx9WvMtkPr ST7y0bRw+LTMjobzoNJFr1S+i8BzxUpuVzhjxdYpp4g73Nb6+ATxtibCrB/6q97y 0ptgFSJI31RQjdhO7eDSJJSzpbNPHGBVcz695T0Mqdqt0AQdmM+EKGxT01NSD7rE hjWqE60zeROWhi88e0htAZhaHZy8tN0dlbL7L2L2hSskxKOIP5/viqy+eYvGfJHr QkCZSoNSD29T5TwXWSjVZTLX/lluwKnnhlwx21NQJ520xgDvV7PTz1Fyle83wHZO 3TAsGCDxsY1t/1l4fLSV27nJkt3J8cA2RJcIVQDjcVwvcrfUK4/YrGdzSjuu+bDs BFfROBSG67GTI3swsaYLnt1kRQPZZx01dUR6d6wVoD5bE563Ls9rF5c4rGJpMC/F txR9HxakEYZNcBqdI1grb4RVxlOX7itb1WZiJy+VR1Kt1IwFLVJ5eeNugXEu/E+z S9nb0Ldhr4TO2zJaAstVAez/7mQSd2e95NYwBR3R4uEZ0MVOLqPDeVEaYiwedimP ToE1bAAhztg= =i7D/ -----END PGP SIGNATURE-----
// DD to DDD in file.txt 0x6E503a5c6C41b5A68cD3Bfff98d8B04bc45CAf93
// #############################################################
// c14 - 1da9b6c0c1678a21d783f36b0b5bfce2fa527f6c
// #############################################################
// tree 973d9246a2e6d6652c2d627abff2b7549cad7d8f
// parent a7645f13560c99eafea6e9d71c80b74877ee1e4e
// author Charlie <charlie@mail.net> 1662228104 -0700
// committer Charlie <charlie@mail.net> 1662228104 -0700
// gpgsig -----BEGIN PGP SIGNATURE----- iQJFBAABCAAvFiEEyPhfiYFBuP8NC1DUUApp/9dLDIUFAmMTlosRHGNoYXJsaWVA bWFpbC5uZXQACgkQUApp/9dLDIU/uQ//ZZYfzTR8rBSYOBwn8E0u+aHkQsWgIc2P Oce/EyW7CcsfGAxK7e0D/ebtCoZrcSErYGt7b1G6o8RUnYQfaEoYfErarXtVjom1 dYTdc3epMCkBvHzXpTXjCoytqGpr5eRXvhs04s1fkBBP+T1GEFXhK/ubCJnZX+z9 RYUCs9HmjQYHbW5Gv1FvRlF6dqzNDoBrBytUCI1SoZWHO+MRTVk7uQ7NlnDQ6yod e2vdAq5yRsEHX7VemfSiGSkNZMMoDUtPUO42aLHBh3zH15EQQMur7jCvgrubpm1D cXuPu5baeCCoXSvb8vwmT8dTPkvImx7PsazhmxHLSfRpAHts1CNUBWB/kqdmZgeG O7PTT23B2gcvXRhmpWApCs7MwrmLNIqg//yuvPa5zoUyCPOqASncOed61KhXfBvB af3zoCXR7WZW3hSFp4Sz8MVm+u5B2QpSzNXGZKwHyaQaXf6+55hRVqst/svoNU3Z FRkpc6gvCr/bKEHCfGEA5Swb1aP8hAeIPdMNWVDvSmvzDGpd9nDh5+cxVZAD7RRd rG/HjKgm8fGv3W2PNilb/nQBKTnSBv9u2PbrHSBGrxix++SLArWWx9rVygw0w9eK L4UN2FtPBu5YtCV0eFPJniDPZe22rBI5vw+9bdErPAIP056i+UZjNfS7AWKmUaYg Bgcz01FK8NE= =+LW+ -----END PGP SIGNATURE-----
// CC to CCC in file.txt 0xc66EF5281FF553f04a64BC4700146606DB921062
// #############################################################
// c13 - a7645f13560c99eafea6e9d71c80b74877ee1e4e
// #############################################################
// tree 0a47fcd0ec434913200199b92d415eb6c75ede15
// parent 9a0a5864111737dcf0dee757997f8b82a53e29f2
// author Bob <bob@bar.org> 1662227494 -0700
// committer Bob <bob@bar.org> 1662227494 -0700
// gpgsig -----BEGIN PGP SIGNATURE----- iQJABAABCAAqFiEEJNIYprrwxY2aoNuPD6jL/IzapAoFAmMTlCkMHGJvYkBiYXIu b3JnAAoJEA+oy/yM2qQK0bsP+wfVVcgEU3ew9vpUeKIEaV7oJXwxxdMF2ge7XT9y Lx0G3nM16CY2yTvWpmCQGNFVtPcajgvodQ4EE2zm11eRFlDvXWFIcOYCnRUxnrjj ALf5UT52nWtGDp3zH0DBOd+SPY+1lMAHs7RdiFxzlzhAvbUs7tjuZuJwEy7DQjSn iws1fzoBL2ZK2g9bOMLRwYlRfHlO3GXUBOFgqJzQLrRkQMJF2BLNr4MGBa82BYGO +JVeatursuriTLxW0ulcwy36N8Ljtm3RofWNK/Dedbfg16thPkRjYaQ6Tttv0pA4 7HQAfQ1OHLXT9K8uS6XZQdfi/kTn+/Ei6o39EtwS0OetjekPBkXo9fLRUgm0nPHY MTXMrXzAVRAFCNIGUtAQXXb1fmLCbDLPr6jhl5F0At9hfFVznIuTr1LF7aMnMI/f EqquzL2GUSvetanSkkUCcq6AzFf59Db9zYrAJrEbrKmClYi+LPBh001QYIEiuYQ/ XUebH4VZaFHpKz58Z14cJJWpdrA9QpFKbSuUKIMDnApVPsNosJ73qVScV2hXGVPu O2VMkpvXWVhEjVP43Uq4IFMxfyQtVivAltB0YfvA+q+bdRteQOiOhpLNOX5oFNsg 493R7eIlaO45q9o/dLvayrka+0GvhPODocjQtdRvCYfvruCd1rIm2LHJO1JfJksk 5XS/ =Y8ee -----END PGP SIGNATURE-----
// BB to BBB in file.txt 0x39E5949217828f309bc60733c9EDbF2f1F522449
// #############################################################
// c12 - 9a0a5864111737dcf0dee757997f8b82a53e29f2
// #############################################################
// tree 0b7ef87f27d33ef9f332b63ddbff030514a951e1
// parent babbe3755b4ce7cdb6572495156d401d69347b16
// author Alice <alice@foo.com> 1662227441 -0700
// committer Alice <alice@foo.com> 1662227441 -0700
// gpgsig -----BEGIN PGP SIGNATURE----- iQJCBAABCAAsFiEEtvSefVgeKuej5CJ5PCZ+3Ki05mAFAmMTk/QOHGFsaWNlQGZv by5jb20ACgkQPCZ+3Ki05mDOAxAAp2UKyCbODlQQpVABw5CGHuWLxyY71dcAAAuW MliDUciVUUBqX8PXaHwpqPKns7SdVIvm1d0KBMattkF3cAeoICwJ/wQCdPRAm/AM TP1hC58c2kve8c2iWOVA6U2SNumLgogTBrMquSjfxI4RvfQKrQlx5VxvVyqVClvR 9ZGXEbPrw8xDwsSEg2R+Hf9URw+dWBS/P1/ucMvi9GxYjafAqBlUkauh90byV5YS h6/lVHLK41kVKvGbplXUSnEUYOKHzHm/pATC+SB/m0l5JrSo1Nv3KYsH1cDBHsyo HEdTxnJdaXAQcD3NNg/sgFWYXf0SrQHapmML5abKU5VEwHlxgrP3pYbWzvrwTwFM n0VUpxzHNQYLHQHA4KGO26pQvoBXevzUCOKpSOWYNC0F3BJMZ5OPMd/ATF3xWYaB lVgE8WsCY3jO8hz0iXrna/dqxxSdL8qKOtAHCvOMUeOkzJ/dA3ut3jIWqXulHh02 Eawt0iJVzWEl7sE1sNp2zx8xzwLnOI0uWehmxehV5ZAGMao1Z7pxghTgLfAprVth cy7r1y0TDLKtIKeuP8OZ/zTAbeS3xIA6hmZzSa9fO9yQGmylMAQmZvDIB4s0GxmM dafDMQJMuXW7W9FRZC412HPdPFxttD2dZHpogjLR5/bqFP981hXkPtkKzU8AjVNU iPnsYIE= =Fbzh -----END PGP SIGNATURE-----
// AA to AAA in file.txt 0xf304255aF88d457Ba221525F3C36188016AFE08E
// #############################################################
// c11 - babbe3755b4ce7cdb6572495156d401d69347b16
// #############################################################
// tree fc852b7ca2855933c5f25d62679a0374858a9cb7
// parent d9bfa3300bc651766755acd8087454e4d8fe99b0
// author Dave <dave@example.edu> 1662173183 -0700
// committer Dave <dave@example.edu> 1662173183 -0700
// gpgsig -----BEGIN PGP SIGNATURE----- iQJFBAABCAAvFiEEy925xuY0ejxNZy074yB0cge4QM8FAmMSwAERHGRhdmVAZXhh bXBsZS5lZHUACgkQ4yB0cge4QM/ryQ/+MWSdNWa0+kzM+aUN3kfzxsmzJQiPc6gQ HpZc4BbKmkilVJBmjIbFnxeJXT/rfwhNZ8Q6kwfbu4R8p9OxLQAbQeIN4Iqh6nUL 0GhbsIP/QntSqePH214JWPZgWtZG33e1utVupg6W6QgA0uxwO5jjiMpTLXhmYXkj j1uVnrDFzNVsnf9fxKozLp14OjrOBhD1+oqn5Lyj5yEXRoirRGiu81/0QGPSrOt2 V0sdaX7foyvmskZnqtC5hDqQEM8zlHbdXd0ajY+SErcRLR3AlA2AXuVWpNhI1jBq e3iiB0Bpqh2HAqMixTs127jePi+u+2TxWZcGiT0zSF1yXpZCe5mMf8/TlLCqsn7S 8n52yygm4l0VQZvye41syErQnu8qOQf2AQh9KUBsHVUf9C72YmAeCMDx1rJJ+bVE +eZk/X8fX1t1C5U2xGG/nSZ+s/cWvMer7G+sclZkbRkW2mQ0vYY2uNuKkxBc3MOM 6q6PVoFTJMcm4ayga65ReC4jljezasdQkf2U00uZYelwxvWFLTAdETQzcIecptrr 25T5duhxtVt5TDD9PxXZJJT3vwgRxBvtWhMHRw/DiexZ1CHnj7fV4D7ESOOsO8mY MkV5d/QlKmVy5bT+94vUBbL29csGwJxFa8MG5NJT0QFWQYE0i3zTjAyf2VxlpEzS 1XK1+9ozZdk= =cxhI -----END PGP SIGNATURE-----
// D to DD in file.txt 0x6E503a5c6C41b5A68cD3Bfff98d8B04bc45CAf93
// #############################################################
// c10 - d9bfa3300bc651766755acd8087454e4d8fe99b0
// #############################################################
// tree 3c01344b927ccdc15facea317ff965961bcb7006
// parent b9e3a66b06076df455d251115147a130458dcef2
// author Charlie <charlie@mail.net> 1662173113 -0700
// committer Charlie <charlie@mail.net> 1662173113 -0700
// gpgsig -----BEGIN PGP SIGNATURE----- iQJFBAABCAAvFiEEyPhfiYFBuP8NC1DUUApp/9dLDIUFAmMSv7wRHGNoYXJsaWVA bWFpbC5uZXQACgkQUApp/9dLDIVkyw//af9wR7QxwwtjmF3imi1EQMtoGCPY71t/ LGIhTqoQzT026cuCGXRI5/Z3JqszRNEJmT7J9Vf/ev0TJPuTGsNd0h+TynfxJdAo Y6W+c7ro7Eb5cOiWPvvb0ilxu1GMu7udLfMnN8i51ofShCCc2SOsZHw0oVIUN4DN q3Wa1urYByOUf3axNGbDi6CRtIBdSR2h8ggfrzLhRXKs6m5WIuXamyB55xnj/rjZ nKDDQwXFkPGPhwqal5CUKBroa2c0cWcWbi891cMcbCNvYVuK1uePhZlB1n7tyDgV Rs73D9j+U4+hSUim7hZK3dInnFt5NcM82njBGhbGyOOJSWR+0/p3vYJLhCev34t3 wtdMJhVDDUe66hUEbLUGThtyLFAhMYOxnIm1i5R70r86YGQb9DAjEUoqt2jAEjFW c1Fmb/lz+m9atztq2g7t6cujyAdm4/iK16BLQkWaFpzSU64SMeQOLqdQtDNH/ypN KhnLMqTeN92b6wc24hrT54dLa01Ex7UA+ylBf8gmuW0oXheeEK6VCJx0X4081lwC fPr49bWQT8W+wyv/hhhe69dWbmo0WbtII+2TGBwRfF44sz1/lGkvGFbvLHFfi4bK LS6uhhdTkccfGiVCgxeFmEFDEikPppZO98sC71IJs8na5PZbyV7XWDxRu/br+Xc9 2PdVIK1TZUo= =yeTG -----END PGP SIGNATURE-----
// C to CC in file.txt 0xc66EF5281FF553f04a64BC4700146606DB921062
// #############################################################
// c9 - b9e3a66b06076df455d251115147a130458dcef2
// #############################################################
// tree b1d85fd547a1dab6b38d4d2762b4fb0ca4b71e55
// parent 2ca0e4bd904c69a38cbe3d2d4bccd7fd87876cde
// author Bob <bob@bar.org> 1662173057 -0700
// committer Bob <bob@bar.org> 1662173057 -0700
// gpgsig -----BEGIN PGP SIGNATURE----- iQJABAABCAAqFiEEJNIYprrwxY2aoNuPD6jL/IzapAoFAmMSv4QMHGJvYkBiYXIu b3JnAAoJEA+oy/yM2qQKG/YP/Rzb8F+UcwrKKanNXjavnZNEMs5AbkJntM1UtXvw 4Qjr5hvnN9Du+TjYsjcJgfJZ+0LCBsBqu1whGlrk0cj97mVxp4KHhI1svl7gRCbv 6xTmfHUbksgT3Os4UrZA3wv5OLm3/AmuXFqA/RLsYJnval4a1M7E1V6Z12KBydWm jB+lNi7laHlgFsHVUums0Mjid2NYOTi+hiTZznQfzqTbubOUXvuO5ZWr01zNtp0s WptJZCS5gWYvqCWPUHXIgHfpk7JjSFIrgG5RxVcf8Thr1F3MA0OlYikPWKat/JKa pcByiHjaNPMe0mpqX4bgOJeDOSZU73GZ12A4OWX8kRsFXrvr8I2uJ8hs6uc6+t2o 55YhnWFNJb+Zb8jauThHYRVHzRZxiiR48YIucHZc8emYotzdc/4iZ+KE5Of53CUd TPlEnRkzqF1kWzubSkY4ADcUSomEbnkuU31/tsgMrVcIIZrsRWCS1hEV+rxmZX1k ZSNLmPZsbbVihIshm/iLqtO6sW46MaKQToJi+DG1ptou6rlkyM21kOht212bWXsv 0dl1VTFE7jHPwVzQj+DeSx1BfcaGuw6h6+C49srZOHXty3uQZxwl152n+f9CrhL5 zje5+cr5E1FGB9xlkLn7QHcPb1eIXMYfkuotCgIYBKgbYWXUZMbOJ6F1mLO5lkHC YHq6 =lPgy -----END PGP SIGNATURE-----
// B to BB in file.txt 0x39E5949217828f309bc60733c9EDbF2f1F522449
// #############################################################
// c8 - 2ca0e4bd904c69a38cbe3d2d4bccd7fd87876cde
// #############################################################
// tree c5a47dec86b3f2d82f707938a32044b43de5a819
// parent 9b42169c9efe329489b74984ef7250bfa0a9681c
// author Alice <alice@foo.com> 1662173016 -0700
// committer Alice <alice@foo.com> 1662173016 -0700
// gpgsig -----BEGIN PGP SIGNATURE----- iQJCBAABCAAsFiEEtvSefVgeKuej5CJ5PCZ+3Ki05mAFAmMSv1wOHGFsaWNlQGZv by5jb20ACgkQPCZ+3Ki05mCjBw//SZaKMA+j5OXvR6bYoJqzs2sBQ5UMQCCSF7na NmMI/ZL7jFfQMq8cJN6WODo+JXYXufIdIRTBcbDGXvP792Y53igpanhSoqiSKnEW ErTH6hgpjJhRIjWQrgyNNAtH+yIzKml8ir8ETIwxYpG5UGHkLfMXU0oYyXTjOUm/ B4dixhEsHNJuIaeh2gVU0P9iSuxpvKVnUuI1AzTJ35tUbSIKqyF3j4xyyJG6HB3/ Id4xUrIGEdzBowDSwYAIgCAsZ7gMynEWh8VjUozCjmKFrlK4MXengBkU6FvruTjC r6LvdEM067BosvbJNZRgYZdf01gDycz653HbeokoymShN97DjjJF7ka3RWUkke7D XgfYEuG4ssdG58IvtzJM6gALU08f48Myor9GgGi5l0CeQKuZGsRAi/Oi79AuctYE fTGBTkbpoqboa410pVe2Auvfb0wlkmvONUI1ZErDk5Mf3cokMNP0JKlj8arz6hr/ caiZ4KfZuostUQTu+6H1BmCXTTfq6HrnjnXVHFEOhX90A7G1vROzM4qyFR0oBFc+ +DmpFcta2/goJ5xBfWlwt1zVGTdz4G3Eupb7kMotwxy5DR4sXByRM67KNMLIot0O zgQRtjV5Y3KPZjd1MzSJGXro4SdaEV61u7W1/oyisQtCqXEbxHgVu6oo6rBKQnvE 5jIsujs= =OwOp -----END PGP SIGNATURE-----
// A to AA in file.txt 0xf304255aF88d457Ba221525F3C36188016AFE08E
// #############################################################
// c7 - 9b42169c9efe329489b74984ef7250bfa0a9681c
// #############################################################
// tree 35fc227d46fdbe1bfe3dda7e61a612f9e4c7a2b9
// parent 69bc539313e2aa84b0c2d166c5aec2572a4a24f1
// author Dave <dave@example.edu> 1662172827 -0700
// committer Dave <dave@example.edu> 1662172827 -0700
// gpgsig -----BEGIN PGP SIGNATURE----- iQJFBAABCAAvFiEEy925xuY0ejxNZy074yB0cge4QM8FAmMSvp8RHGRhdmVAZXhh bXBsZS5lZHUACgkQ4yB0cge4QM8PrQ/8CYzDcHU4uA70LykONUdubq8qzTzjgGWr CjtrbQd+aHYdFE4h4O0RL2qeI/rJ6sbMkb3Or/zDboU+ceyNchzxMh6rQETWrUc/ 3jhtJ9djjyNC0YMnWTLzO5bmggweeEP8YKz0AvbQ2FX8YXQTkvX8eKtkr6sxuP1j xJOG+5JyGnjJ7a0o8h1FnF4swXpbhnFupmd1LnzhUKWa3c9DObLGBfLyUPvuBXOe G9O4CkWuKiy/ZHn8hjq/zi7WSiR3/REzolau6LWM0aylgk2qPcvpiUuxv1bvjKoZ u7Hq1U5k6xmMRonaRoSiiLWQBuN5G9OVDNDPLEqKpqXgoXiC5Mzz2aExstWiiXAd eD6xG3vCiucmj/8crgGMegec/Subsa+F+IlRuSjg9+FKztDQzX8PSn9UD41r5fYz hEdJLlHdWXIca8QJgnCwNTE8lIM0SZMNNqyFij6lH6QqAoq4453vudXYJsxVhh2i tNZvgDW4u3wXVHVbw4BJ2MATBQ6fN7D079OE2OJgic5aikadF2IuUWxBFGqdGtdl MbN//uuOyWZSxkFpNoDp5R1efAwLvzwlo0Zq8avzHNYq0WFliNAqoIPG89Ac0Dao M4W4UL1yddBljglcj2mW1cwiSH4vttx+Evf9TwGor4GUlDYp12qYqHx9pMx2DfSf 2IhoiSLk0DA= =iFSs -----END PGP SIGNATURE-----
// add D to file.txt 0x6E503a5c6C41b5A68cD3Bfff98d8B04bc45CAf93
// #############################################################
// c6 - 69bc539313e2aa84b0c2d166c5aec2572a4a24f1
// #############################################################
// tree 10c4b16d84bf8d2b325b30b6ccb11077dd7ef3f6
// parent 618dfb41eb263ed5cc1a6a9ec5c9f8fe8c61947c
// author Charlie <charlie@mail.net> 1662172697 -0700
// committer Charlie <charlie@mail.net> 1662172697 -0700
// gpgsig -----BEGIN PGP SIGNATURE----- iQJFBAABCAAvFiEEyPhfiYFBuP8NC1DUUApp/9dLDIUFAmMSvh4RHGNoYXJsaWVA bWFpbC5uZXQACgkQUApp/9dLDIXs+hAAqBN8l8WqXc2mmS+Z5htf/uBsNILKR+zN oIwEP1Rc70J5hOFjEC7tgZsot6W1hgR2xn4kIQRuFPj5NkQKAFKH4fyo2ord3lT8 zKGNiZnb54t62Yw3crIdaHbk082LT5VUNFKXFsjVm+m2Y3s/53CdHMe+kPYHMKcp pKLqN6fIE5oXNYm7hyu7uUUAiSG9tQjLR5Gu1aN8KR050z+j8IpWePCvQwqhRtRJ VNTOjsxBKXWlQ+xh3jIRe034hR7cyGzRlMI+YC46QKgXpkxt8quZBTdk5hCqd52c ZbV7zaBSefQpe7VQ9fAlxUG4xyNfNMlDKypyaPPxwiHeAHzSLElVCz9QQXh2enEU QU7kzyu0rR20QKQPHQm4mp7Jr+rhJIiEdYA/qccK7Nc5H84y3Yj6QWXj+Zo2WRCo uHYsCjglijoyi2XHdjr15KQ+WCkcrV0KYHMwzDk8TvjJwR6SQdful0I3EtCwk3fL J+79ZERIRbxhv3RMlkjrDgOB1E0k42WqHEP0rxIKPsNYqEM85VX1SpHzA64oQs6T YvHhnZHN3UNLFYevLZC3is6UOHZXzlwRF03vwZ++4HfHo5nbaO5KvWSYi4EQkMvX bEEqEeof33pexr88c/gqzTUsfO0YC8FhxTB0KZUAF6M4Ws+x8TOF5+iNbN+2Cp1G WhPPwjE00K4= =La9g -----END PGP SIGNATURE-----
// add C to file.txt 0xc66EF5281FF553f04a64BC4700146606DB921062
// #############################################################
// c5 - 618dfb41eb263ed5cc1a6a9ec5c9f8fe8c61947c
// #############################################################
// tree a7e8988070f43f5909722db37c32fba2dd1369e2
// parent 0cd3c6a3887a47b21e1efa61e524d2cc98defb90
// author Bob <bob@bar.org> 1662172592 -0700
// committer Bob <bob@bar.org> 1662172592 -0700
// gpgsig -----BEGIN PGP SIGNATURE----- iQJABAABCAAqFiEEJNIYprrwxY2aoNuPD6jL/IzapAoFAmMSvbMMHGJvYkBiYXIu b3JnAAoJEA+oy/yM2qQKkc4QAIGDXcUISiqM5GJK14gQtANUkvmrIY7anYDLC9n+ 0jTxJZBQGEU0p/EaLliaJDut2FFZ5iEpwLAM4sg4GLTYzeSEIoQxcD6Aj7X+K+Uz bevVTvOOi6r2hMkkojoa+EPtDKStQ6sh6OLc3GwdQEoKVwIKMPl9Z1mhwoUDVNpR rkv05+OVASkCZVQXp5WRyeKGCXIU8qtgUjLELyf0WZ6gUbYVjcFHkz1pl3dhtCGV En7zWYHSIpKiyclujWhwTsfvrwv0pRBDE52PAFRIvYQT0jCBPiYg9TLmlN+eEvXc VwqA85PPcE8ayxy+YxkuCmk9Q7gD/UuHZe/LRMJfLt5o7fsCHmrTRvq7c2YgBMEN /Y4FoVvaYo9y8+uiwtOXNiCmWk5EZ0ThhVptpXFIXEyjPPlpxUXnTL9IU0Z3VExQ 40RGZsMtc0ZefMI5Gy976tXmBS9V3DX02hozZwQe3ppbpt2Pjd8veQuKRQIbKCzx lnAPWioO7t/pKxrWip2B/0+63WL/i5gP13vqSXZihZKyuhNT3Z4kvlLYsyXhGzjF YL/kgAqTuL+b8oGwI33Y7fIVHSMcjF4nTw0xPppKzS2CmyOG6h7h9bw4LGLdzY7u wf+LxrMut3N3UysDwlTvYHEhHdKqK+Q8sNe94JZJuh5j5w9tCCeXqH8ZABIpWvMN DQT4 =OpVJ -----END PGP SIGNATURE-----
// add B to file.txt 0x39E5949217828f309bc60733c9EDbF2f1F522449
// #############################################################
// c4 - 0cd3c6a3887a47b21e1efa61e524d2cc98defb90
// #############################################################
// tree 4844a6d812f2bb3e1d6d35f2dd9cea71e28eeccb
// parent 0716f9facad1b33b0a994d97658e63c00a0cacfd
// author Alice <alice@foo.com> 1662172540 -0700
// committer Alice <alice@foo.com> 1662172540 -0700
// gpgsig -----BEGIN PGP SIGNATURE----- iQJCBAABCAAsFiEEtvSefVgeKuej5CJ5PCZ+3Ki05mAFAmMSvYAOHGFsaWNlQGZv by5jb20ACgkQPCZ+3Ki05mBFWw//aQXpLp2b447gwZKEqDWKaNC3CPN2MX31CaQr I+n0sMXfyQ/EF0l85jMi4Il6kuyF7RmYWxsXgxszRq9Dn/jhEX3INqcXl/lo4O55 aYKYwr+XCdeYiGHw3Bbuh52D0IvhozVuFqqd2MRpCxPQ5wfuX9TIhDRNWGs0uZXb KfyM3xPoc4CnlvWkp96CdSpz5sLwdPIY67hOzSysRNKO/yf66vPhXIGtllGOs70p SQfUoT3ImEnGXN8VMV/01an988I/KV1A+kTAmi4MSgHCzpqVN1iuFXukKzKpK95B ErW/S5BXycvI6cKbPjlvHw291ngFByXs3Ugb1kRJ8R0N4U6bvBvPX5MSFScGU8fK 9qqL9fX/mYfXQNcy/u9tdtXC8hzQYY5cskRT4omvKXEG/+VObPGphs8twk5uXWC6 xv8gJ3BLKXTjM8szKXqe5vL84p3shN4CCTGJoxzhium+weSVMl5ufUnO2gUQn69H 52u7Kzf7FuXIZ0ZSJI2duQnLVcTqCD/nf0SzTS3uMGAhOhA1XnOxP6au+QJ/XjaM IVpdHA+DBekFTU1Whad4vc546VSmW3KvLk1G8MOsyia4ORXq9XWqaibS2yZ3XKWM YMJFNb7guOIeI7iWA48V8+cRWncxlyUpqtEVYNseM/4WX80CZURR/EcB1v1244TI +GWTusI= =P1bv -----END PGP SIGNATURE-----
// add A to file.txt 0xf304255aF88d457Ba221525F3C36188016AFE08E
// #############################################################
// c3 - 0716f9facad1b33b0a994d97658e63c00a0cacfd
// #############################################################
// tree bdd68b0120ca91384c1606468b4ca81b8f67c728
// parent 5f288b6e0791d3b001d4e02871c0db4a7f0ae67b
// author Alice <alice@foo.com> 1662172428 -0700
// committer Alice <alice@foo.com> 1662172428 -0700
// gpgsig -----BEGIN PGP SIGNATURE----- iQJCBAABCAAsFiEEtvSefVgeKuej5CJ5PCZ+3Ki05mAFAmMSvQ8OHGFsaWNlQGZv by5jb20ACgkQPCZ+3Ki05mCjjg/+Nhz+m9T6BL9bLWANWsecFTSlfbe9biWvrVK3 GaozDzg0fJePmaIIEfjeknUiJo56hYfknKuNEQBYWyRHktJhoKlYwdY9c3bSRC7f L3nVQ/9c+hU1Qp6JxxYvjALhq+ALRt2Wvm8ZBhOeH3abn1RSqbKSConQ5F9l4mZ4 GK3RXFXix9Ox17whbqj2shYbEA3hijgDRLhXhKXyuxcgVZ0ZSNXn38BQ9xdsTqY6 UeC6tRvG91MP/wpI3/Yg0O37NIsf9p5ugYFs7vHC7gH1g+Xh0mh0GgjGyK2bzNX3 ay57YIBPVc46DALjMmPIOUBu6OI5ektYP4x6j3/5YMnrWiJJ5LVqUuBAn7Cjr/H2 KlPluPhvMyVFlsD3/yc5wGSHKWUvOxN0XBS4dARaXkIU5ioRWE1cyzKFo4gnYY3p XPJbuCmnd1YIW04ioEl0CCnODaw24/0N1R7yQ//123Pdqot3JluUeyFWek0yhleb KCiQ2HuzDKUx3zojAxj6sPvfg/cyQAMGCl9oqrDasISHd4nmHLAsoGyknolZty1/ 81tczG8qZlr+T9dBBA58SS7IcKtRHVm/IRF9+BHQCHIDaAnlwd47NUPoalyo2UUJ Wsc4RJK+Rdv0D4gy9D256grnc2vC0Jh/fu4+JlY1bl87QifDS+c8ZJXqcDOzkvSx StIDmUE= =oSzH -----END PGP SIGNATURE-----
// delete config.yaml
// #############################################################
// c2 - 5f288b6e0791d3b001d4e02871c0db4a7f0ae67b
// #############################################################
// tree 04cf2f313ba4201d140c580f9763924b35af5559
// parent 4a6c87c8f1f89dae50339e315dee0a2d7a0e6796
// author Bob <bob@bar.org> 1662172345 -0700
// committer Bob <bob@bar.org> 1662172345 -0700
// gpgsig -----BEGIN PGP SIGNATURE----- iQJABAABCAAqFiEEJNIYprrwxY2aoNuPD6jL/IzapAoFAmMSvL0MHGJvYkBiYXIu b3JnAAoJEA+oy/yM2qQKq9wQAMWEMZYue8wieZ1Nz00S1fW3ruWycCvstgsF5zKj ba4D6gXoabNsnnhq0asMOSxF6nwNrGBMYTbUtKajF8Wgq9QITkvyOdixzBHP4lnq JzAXDbSve4jMvljgpQQLIU7ribNhwAGrPMF9yrILMSdYC3yTu1g1txT39Yf7g2eq q9wKlHrpi3y4riCkA9G85tMRXm8PoYZqElHBpziFNJD+PEpUlAMc0xcwEqBlLE9H PtucdGF3OfcoHkhWtbu9WPTz2wcmAOYiyziLc4aKG9a7lARbL5ko1HZHUjp3KtAk JoR6FmRu9O30Ym9v0mYUJc5j0A0FuhwUTPC9Jb53PKcI2RwA2Ym5CEqf0+9yXjVd RqbrV+unUuu0VQ0b4aZklZ2aGAJMfvFeVB6WbLBSBsQ3JzrsETWqto21at0PpStj liR5izU+mTaoicPDZubV5Gi0lyH8w7r5IadjU3VjHAN6nJ8A4C1QOHh2cC/Cy4Ra jvHwf7ab58WUcMrJFA4tlgqHihbBNnO1I++3w0DGez/Icw+ZXNnwtxzuGPtFBH8p MSD7VlGZW1LhX9uNYm4TSBFNLhKPwVO3hTLeaeJJQzoImso3PGB+V75lCEflE/8g zIVk/WrUvk9iMrj0B1eU+Y0sTCIMDAVVxYU3UlAXpzjhmymaJJ6jz0dTOL/84K0/ HUy2 =vEEF -----END PGP SIGNATURE-----
// add config.yaml
// #############################################################
// c1 - 4a6c87c8f1f89dae50339e315dee0a2d7a0e6796
// #############################################################
// tree bdd68b0120ca91384c1606468b4ca81b8f67c728
// author Alice <alice@foo.com> 1662172111 -0700
// committer Alice <alice@foo.com> 1662172111 -0700
// gpgsig -----BEGIN PGP SIGNATURE----- iQJCBAABCAAsFiEEtvSefVgeKuej5CJ5PCZ+3Ki05mAFAmMSu+IOHGFsaWNlQGZv by5jb20ACgkQPCZ+3Ki05mCntg/+KwUzHopg1Qeh9j1+t1HgMclX4k1icMTnNLL1 0MXtN+OBVU2fLCaH+5sf2t1Pft7Nv1iqj12w3aMbWOn5j+21w7dx+mMbIlRbtslw t5+ZZr6ERstYXopqzp2XQoScPm6Y6ItUJ7bQs4NdMkcKlRSl9P6BuKiBheQfiR05 2Cw8cQNyswhGrfeoP8946d/zz36tvvZVG7pWoSspEWa6hFLLPDuUDVscb+bZP83e 3SXAqnV0rYwkupho4u+DXQj5dKyLi3JF3c4vej73KT7EmPlESyKJ4d9F9vXRLbvQ MvY6eSPzxd+pXWFGee0DOHjkJtylbmO+6CtfSu/PpWLI4O1ikBvidDEZnoA0rfVS UHVFkl123lFvwQ9GsW2+xCnumhViYtTf2iyzEeIbfFmp7lNd18HLkEMuv4oEXJVl LQoTPsdbxhCBjFAeD/Hha8TFQPV4JhGhw63oocQoFecHYWOcef/6lTopyj7dxZWX aSU0v+t/F7Z7Pod6qXV9uyXjojcP9RVKScD9z9JzWh0Uoq7aoRmSHyDEZK5rjiL1 Xh6wwOj6x3qNjximGr54qNVvBGZupY+kQ+72U4gxlCj//nO9tsd+qEOtNgM66/zC NQK5gbqLdSr0O5eCOKiIdYYVH+iSn6iQphdoci8PGK6vxiG4G+lfSl7M/av9awkw qhrdeuM= =AJPz -----END PGP SIGNATURE-----
// add file.txt

// --- TAGS ---

// Full example repo tag data, can be found by running this in example repo
// to iterate through each tag and show the tag info for each one:
//
//          for tag in $(git show-ref --tags -s); do
//              echo $(git cat-file -p $tag)
//          done
//
// #############################################################
// t1 - 66a50fe1ddad5f812836e942a7200392c5311d93
// #############################################################
// object 4a6c87c8f1f89dae50339e315dee0a2d7a0e6796
// type commit
// tag v0.1.0
// tagger Alice <alice@foo.com> 1662327756 -0700
// first tag
//  -----BEGIN PGP SIGNATURE----- iQJCBAABCAAsFiEEtvSefVgeKuej5CJ5PCZ+3Ki05mAFAmMVG8wOHGFsaWNlQGZv by5jb20ACgkQPCZ+3Ki05mCOcA//YUK5BEIoJ+dbdTeqWbXt/Sa66/qBaMQJWS81 llrAaDh3CB4IWadnnl+26qFktYvI5qHNxRmBpZAPAwUGGun0PPIZyvyX4twfoxu0 uwUiIEYJxT5e89HfBBhBwpTP61+a97teq4S9D1HU2K8k1h4JVyIqMczsSzGnvS6f 2II21c7XVLjKG6KKcnkHviLBKZHuH+D7pTp8iDaYw0YVZI8+afreRvK66sTXueD/ VDK0O1/0agU78OD1AIvepc7M0NSubww8hSCxbkujcckZjBUR/Fnvy2XWTgvKfN9e Bs9b74BD4C3pGuBbYfIM20fdT0Vo8766ZhychiwZ8SEDsURRoIIRQoO0bDE623de +QZxHJRCNwoliaiKW3vGqCYowXQ6Sl+sQHBDMKIzBwLDmmOBEhLyr2iktoVbclOh fR1FcS4OcDhqOIAyKNY/ldFdV1Y9KA5YNyLJIvgUnWSxD6L3M9wOGRuX3p2chbLT vcyFDZ0MwGUlRsPTb/qbUuqD4cGq5iFdumZSS9haFvbqmXF0mjeJ/FNjBxnazrSn jQM8jPbNjXo4p8R63bU62kQyyNFNmIgHyXY7Fgllon4SGtPrMEHeKGFKbO2jlrqL oRHVkKIqFwWcEYk16XpbrCZlNVuYx4NvOtHUFxxuhVog3IiTLSV2Xq0N3Xfq7DSD gEez+Dg= =XtCK -----END PGP SIGNATURE-----
// #############################################################
// t2 - 765094f73f8d6a9821bc55cef346ecf0899dac7a
// #############################################################
// object 0716f9facad1b33b0a994d97658e63c00a0cacfd
// type commit
// tag v0.1.1
// tagger Bob <bob@bar.org> 1662327806 -0700
// second tag
//  -----BEGIN PGP SIGNATURE----- iQJABAABCAAqFiEEJNIYprrwxY2aoNuPD6jL/IzapAoFAmMVG/4MHGJvYkBiYXIu b3JnAAoJEA+oy/yM2qQK8nIP/0PKYa1wsBKmXK0Ta2HItgYDPug1NH6kjcoIyEmR icSH86xPi0D9CWkWUT3i7879BqktQl80V+aLIynmpG01gcIv0tKZI8TvH0KTS7VM ZkqFqopZ7K+tbR40l48Ekmbyg+smiw3jGg7tkTlXGoaD8HDF68m5LKhK75gSI4Q4 KckChSg/dOy6oGNFAe8JOSWak6r4NWZANH2lPRz+nSqRRKfPYUF5bwA2SGUyU1sV SnpnJMlzqL7y7Y5jZ0955dCJtQM5SZ+LEujC3aHz6SAEJN1dhaKwrNowgUxSHek5 D4LlsOIKMZCv7W74EEMpKykAYqsWR9GkdjnTb9I9lHLizDNWZOoJGquICqen/o8O l5+eOBHJ7yYMrwQPS8mABjKZB7wj0HyMJoBWOW4DqvgByHwYxvP+S8YrX2IEqn3i n7I3u0/MvwPfjpyX5TbQUo7+RloEiyXaYbUVRodzVHbS1LOmH3zJEL+dJ0SWDKsd br0DCcxunQ03r9ZpmT4acoe3NzFrHiDeM6o8zjTDJYuUo8vKyBEFLpHF+D8W1Add A2oSOcB5VLWAIFs2Ta6LMHc4LwWwVGF7kPFcI2utdMNfPxP7z0pTVixr77CytEyo tedHRQrqWyNsV/xjh/6DBGcGJdAWtZSCNb1oH8vsOWS2NMpdZnUbZIbQB1l7caFA j288 =yb3Z -----END PGP SIGNATURE-----
// #############################################################
// t3 - 353f2824d02cf7730cd7c31c92ab91ff772af0c5
// #############################################################
// object 618dfb41eb263ed5cc1a6a9ec5c9f8fe8c61947c
// type commit
// tag v1.0.0
// tagger Alice <alice@foo.com> 1663127239 -0700
// third tag 0x1249723FA3B0Adb68D7873fD611691e7B6fBD081
// -----BEGIN PGP SIGNATURE----- iQIzBAABCAAdFiEEX8U19Gi80ff7qvGMcyaH1ReMgGcFAmMhTscACgkQcyaH1ReM gGeLzA//UnnGwYLT+Bb3BXBXtUSqDrgpMSkdNwnyB5ucnlpg5Rl7tUY2TTtCz8K9 Ewwr311EBCfejFr6SYffkU2xbSWI2sQxTfCJeOE81h/3gR34NGLcTAv/UQNkBuGe y/j18Wz4ugGV5WG8r1LuEbq+jktxp30NLn0F0rgxfu6zeQVFxGaJkfmmUw33WNCi Br7dxvLT5CuvwlSDEK8duhOgn7ZRH1/O4kslNJC8aeNbNis01YxNrD75OUIFSZoL hD/C8bRficn/Mcdx5Q5CzeaD0odsDBDAO0sIognmbtFbds4x+jtbiOi1RDaCsJAc Aq7uJ2Y+/3ukUoMLF5bKJnhU2/hQT/3OSyiB1lx/F0yfLTzeEfNNX8lnFGFYy4cI QD8b3Pmgbn+FGWRt6yUTDUb+uLPID/gOARvFf+q4YERJVDbD+MWCoG+WhmYBPdWw 3W5ZFb3/S4kTBZMzeAbgkJ6gY6mY725AFE9BWkueFGM7Hl/URuxioi75yLft1kvD JWtj54TMjUL+6na8fSP4qQ3rWPPp9qw/Q3pEzeo1g44MOhTF/kRQMeguBr4uVbKs BD+DpIiSGf026FndjRsMEL485LondGSkIyRxuHfwsgkZKEyTg60lj2P83YNSRepb whj1LeLC9xSaSh0HriGYk+4KlF70HKoqGGg8n0wc9Q8C+7T9vi0= =ZA2Y -----END PGP SIGNATURE-----
// #############################################################
// t4 - a08b408e1659c75161086305a54da5f96f0d6658
// #############################################################
// object 9b42169c9efe329489b74984ef7250bfa0a9681c
// type commit
// tag v1.0.1
// tagger Bob <bob@bar.org> 1663127328 -0700
// forth tag 0x1249723FA3B0Adb68D7873fD611691e7B6fBD081
// -----BEGIN PGP SIGNATURE----- iQIzBAABCAAdFiEEX8U19Gi80ff7qvGMcyaH1ReMgGcFAmMhTyAACgkQcyaH1ReM gGeC+Q//QB5j671BsM0HEskO3dFgOjKN+wYxLCtYtqX2W/6T0lMMgLpzS49Cu8Oa jDa0rXPwON7LM/RJtlPe79HpFneTQjzfyvL35ux/YCt+4vcMWyYvBSkIjSqlxLoH ZkZBsZbKh+FGdgHnyYW86XRr6hPOxwc/sVvZBQavec8tHpdUAf8H1NzCJWXGMuNK yVQ/5316OwtU7gTWHXaVgcn3Icfwkyyyv2JNEHpLntcpmZ1gJ3m8fcLAj4MkSmx8 abVON3Ydrsu3gu1ain3uJyJPruzL+QWrjPG6X0UNoi5z2rdkwDPVBrV4fpsb9Zqr 9yXPpXVl0hmcCwyIkjGDKK1m2OyU2tairz+v1oghlloLbfzYYySeYEiDYwasJZpP l1BQSAWr7U2/H8Eon/RCyJFtfouJt7kcRKtfT6P3XF7fp1o7/fpWezN4m7iZFYVi bHI72HZX8wHop0AcVofh3+EBDnde/ZMySb39oEWWsDkUVtfuM0wcoVmPLhBNVrrL JSMEjYLLiBbqWSlurV93Wjo1ywZBe8qKdvTN4W8OIQkpxUqc93+GtxIulIvGC93g a+yCX3jqe05kYhP904k83CMJz9iMGSfa+m9/qIHqqTrCbkoUVQIea5S5/9gtGvn3 UMWBJNyp2HktjAKPs2IdZJYZloJTG6+V4ISdz/n0TmWu9Ue9cyc= =6UZA -----END PGP SIGNATURE-----
// #############################################################
// t5 - d7815c9f7ef87b1d746e8ea11f652933ba1a8cb6
// #############################################################
// object babbe3755b4ce7cdb6572495156d401d69347b16
// type commit
// tag v1.1.0
// tagger Charlie <charlie@mail.net> 1663127338 -0700
// fifth tag 0x1249723FA3B0Adb68D7873fD611691e7B6fBD081
// -----BEGIN PGP SIGNATURE----- iQIzBAABCAAdFiEEX8U19Gi80ff7qvGMcyaH1ReMgGcFAmMhTyoACgkQcyaH1ReM gGc8Jg//TlNIQ9wv8lspnOBmcTyosIsBuzdr/UBRAatbnNJptzj2shisEPpFLyeJ pQ8Jwf21E0zcxrPrX7mST8+RfSOJl2OxluqpcZjLkxU95vGX/pY8e25jR8aqICSF 2gN8lvnCnuLHjq/7BISk3VRpCj2L8z4DiPOlcHqbOSKbjBViACJgRRZnj1p0QVZw sGXKwiLIvfieFTZuW16uOqAqmS9ifJT6U1vnOPmHW32bIm+q3Oqoqvs6CswycDE0 BgYbdp+y5OFzLPgRKv+cVyjAQNBZMQuBtLXUssjnKXbsMp2qG5/h4HcyPUp2lbc6 ESe1EmLrGPGBe5QoeTNNlGUVM0jnoDM/VRmZ+xl2pJxu3uJP9PT/DmVu2nWkrWVk Xc+iJmycrrL+dd4t1ibro4J9EJ1XquKE86o+MA7jEDfhiKCLr+ptu7oAO148ef3V wxchM+nYlCmchHRCVWiUQimoB/I93ItZLOvsA8BlNa/L6ZT+kgVi7OAktw0blfLT 4vUclHF9eVGf3taSvhP5LIhQTYa3IFiPLS9+Wmro1FP454ofrOQIiiHqWM7pv8Ez 0XsQGkBTJPzu59nDnKiapOYoZ/6L6izQZACxjoWpUDaJJpDMBCDKObEbBeM2jDcm 8i+Ddq5C82JsETa9iEFVbwKIJD5rP5Y8Joo3hQlK1q3sKdTs4K4= =nZxM -----END PGP SIGNATURE-----
// #############################################################
// t6 - 8fccc24d51545cc9d1fca5f3c8e4e6b42c41bafb
// #############################################################
// object a0c8c1b5083b1d5eaab179a288bbf79295029b1c
// type commit
// tag v1.1.1
// tagger Alice <alice@foo.com> 1663127348 -0700
// sixth tag 0x1249723FA3B0Adb68D7873fD611691e7B6fBD081
// -----BEGIN PGP SIGNATURE----- iQIzBAABCAAdFiEEX8U19Gi80ff7qvGMcyaH1ReMgGcFAmMhTzQACgkQcyaH1ReM gGcn7g/+PeCk0Gfr7Wiw4WuLptNftG49AlA/I+BUvjQcVk1QdJhc8xg2exgJ5dVv xUzXf9tvPHHb3RyE3ocZjeMYAiAdq4othr/d4KWaPPFit8Qppk5vnfPzf6X1KpQZ DpHjoC/PFrESVoyQKTgM9APjAd2SNxOI4sC1yCbHVpY2/rPT8gfmT/fVhs06/54v kSCWBcBuzOfhc/pkUVBrGNj3i4epUe8mHoJgkWlbj4zivCuBkbklQ0VMaLYv2Y5r KNMOzeroRcQGX3nSmfNESO136tb6rAzHJ/0H67sLoZcwJkGdZXNBE3io/C6/zhZ7 9FmAgZKwcfSTbaftj6iB7VQAY8TICAAMcjDlDBvsI1HHuitQJDKqdXaymUhfoT/W zOysjGrFfoP2ZoTIc5ZqSjT8JhxKUowdVppsK3DDZONPydRp1E/AmXk8SdWEPhy0 7UJfFCN3L+NVUeAKLH+v1rGOh951lSrzus3zbdSdghK3w1vIjaKtTMm+Tx7KcVIk pnJkv2loKqwMZpKYPNpGJRP8kiiJgJg53XtWtUHV3vUN2/DMqZuPmtt8ev8ScBQ6 k0d4JCMYj+wVnWUkydOWVhnXRwcrikIznt94IV4nctcaWD49wphvJhxyLi2Sp2tw ZrbZVWGhX7MmNq3l+zy/MEh0u+sN0EjNVxOSq0N391tsZaNkrxQ= =rRph -----END PGP SIGNATURE-----
