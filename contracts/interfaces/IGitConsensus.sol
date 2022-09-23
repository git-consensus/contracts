// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;

/// @title  IGitConsensusErrors
/// @author Matt Stam (@mattstam)
/// @notice The interface for the errors that may be thrown from Git Consensus.
interface IGitConsensusErrors {
    /// @notice When commit message does not contain a valid address.
    /// @param message The commit message string.
    /// @dev Can occur with `addCommit()`. Specifically occurs when the message does not
    ///    contain 0x followed by enough length for an address (40 hex characters).
    error CommitMsgNeedsAddr(string message);
    /// @notice When tag message does not contain a valid address.
    /// @param message The tag message string.
    /// @dev Can occur with `addRelease()`. Specifically occurs when the message does not
    ///    contain 0x followed by enough length for an address (40 hex characters).
    error TagMsgNeedsAddr(string message);
    /// @notice When the sender attempts to extract a substring that is out of bounds in a
    ///    string.
    /// @param offset The index of the substring to extract.
    /// @param substringLen The length of the substring to extract.
    /// @param stringLen The length of the string from which to extract the substring.
    /// @dev Can occur with `addCommit()` or `addRelease()`.
    error SubstringOutOfBounds(uint256 offset, uint256 substringLen, uint256 stringLen);
    /// @notice When distribution hashes/owner array length and values array length do not match.
    /// @param hashesLen The length of the hashes array.
    /// @param valuesLen The length of the values array.
    /// @dev Can occur with `addRelease()`.
    error DistributionLengthMismatch(uint256 hashesLen, uint256 valuesLen);
    /// @notice When a release attempt occurs from a sender other than the project's governor.
    /// @param senderAddr The address of the unauthorized sender.
    /// @param expectedAddr The expected address, which should be the governor.
    /// @dev Can occur with `addRelease()`.
    error UnauthorizedRelease(address senderAddr, address expectedAddr);
}

/// @title  IGitConsensusEvents
/// @author Matt Stam (@mattstam)
/// @notice The interface for the events that may be emitted from Git Consensus.
interface IGitConsensusEvents {
    /// @notice Emitted when a commit is added via `addCommit()`.
    /// @param ownerAddr The address that was contained in the commit message. This may represent
    ///    the committer themselves, which will be the case if the commiter wants to recieve future
    ///    rewards for this commit.
    /// @param commitHash The SHA-1 hash generated from the commit data.
    event CommitAdded(address indexed ownerAddr, bytes20 commitHash);

    /// @notice Emitted when a release is added via `addRelease()`.
    /// @param tokenAddr The address that was contained in the tag message, and the caller of the
    ///     `addRelease()` function. This will be the address of the project's governor.
    /// @param tagHash The SHA-1 hash generated from the tag data.
    event ReleaseAdded(address indexed tokenAddr, bytes20 tagHash);
}

/// @title  IGitConsensusTypes
/// @author Matt Stam (@mattstam)
/// @notice The types used in Git Consensus.
interface IGitConsensusTypes {
    /// @notice CommitData is all of the contents of a git commit, which is equivalent to
    ///     `git cat-file -p <commit hash>`. Address of the entity that should recieve token
    ///     rewards MUST be included in the message.
    /// @dev Struct ordering differs from structure because signature last gets some
    ///     gas-efficency gains, (notice on commits it comes *before* the message), because
    ///     that field is most likely to take up multiple bytes32 storage slots since it will
    ///     almost always be the longest.
    ///
    ///    data for SHA-1 MUST follow the (arbitrary) way that git pieces it together.
    ///     git commit format:
    ///     ---
    ///     tree {tree}
    ///     parents {parents}
    ///     author {author_name} <{author_email}> {author_date_sec} {author_date_tz}
    ///     committer {committer_name} <{committer_email}> {committer_date_sec} {committer_date_tz}
    ///     gpgsig {signature}
    ///
    ///     {message}
    ///
    ///     ---
    ///     notes:
    ///     * {signature} must have space after each newline
    ///     * ordering of {message} and {signature} differs compared to commit
    struct CommitData {
        string tree;
        string parents;
        string author;
        string committer;
        string message;
        string signature;
    }

    /// @notice TagData is all of the contents of an *annotated* git tag, which is equivalent to
    ///   `git cat-file -p <tag hash>`. Token address MUST be embedded in the message.
    /// @dev The token address is used to mint new tokens and check that the token's corresponding
    ///    governor is the caller of `addRelease()`.
    ///
    ///    data for SHA-1 MUST follow the (arbitrary) way that git pieces it together.
    ///     git tag format:
    ///     ---
    ///     object {object}
    ///     type {type}
    ///     tag {tag}
    ///     tagger {tagger_name} <{tagger_email}> {tagger_date_sec} {tagger_date_tz}
    ///
    ///     {message}
    ///     {signature}
    ///
    ///     ---
    ///     notes:
    ///     * {signature} is not prefixed with 'gpgsig '
    ///     * ordering of {message} and {signature} differs compared to commit
    struct TagData {
        string object;
        string tagType; // 'type' reserved word in Solidity, hence the prefix
        string tagName;
        string tagger;
        string message;
        string signature;
    }
}

/// @title  IGitConsensus
/// @author Matt Stam (@mattstam)
/// @notice The interface for Git Consensus.
/// @dev    Errors `IGitConsensusErrors, Events `IGitConsensusEvents`, and Types
////       `IGitConsensusTypes` are seperated in seperate interfaces for clarity and
////        unit testing purposes.
interface IGitConsensus is IGitConsensusErrors, IGitConsensusEvents, IGitConsensusTypes {
    /// @notice Notarizes a commit on-chain, building the hash trustlessly from the commit data.
    ///     Stores the commit such that `commitExists()` returns true for this commit hash, and
    ///     `commitAddr()` returns the owner address. Emits a `IGitConsensusEvents.CommitAdded`
    /// @param commitData The data of the commit (tree, parents, author, message, etc).
    ///     `commitData.message` MUST include an address, which determines where the tokens are sent
    ///     when/if the corresponding commit is embedded in a future `addRelease()` call.
    /// @return commitHash The SHA-1 built from the commit data.
    /// @dev msg.sender does not need to be validated, since malicious attacks (e.g. adding a commit
    ///     hash that does not exist in the repo main branch) will have no downside for anyone other
    ///     than the attacker (who pays for gas). This decouples the sender of the `addCommit()`
    ///     call from the actual owner of the commit themselves, which adds massive flexibility.
    ///
    ///     Instead of encoding both ownerAddr and tokenAddr in commit message, this limits the
    ///     expected # of addresses in a commit message to 1. This keeps the usage simple (1
    ///     address per message rule) and less error prone (parsing 1 is far easier than n many).
    function addCommit(CommitData calldata commitData) external returns (bytes20 commitHash);

    /// @notice Notarizes a tag on-chain, building the hash trustlessly from the tag data. Then,
    ///     mints tokens for the owners of each commit hash. Stores the tag such that
    ///     `tagExists()` returns true for this tag hash, and `tagAddr()` returns the token
    ///     address. Emits a `IGitConsensusEvents.ReleaseAdded` event.
    /// @param tagData The data of the tag (object, type, tag, tagger, message, etc).
    ///     `tagData.message` MUST include an address, which needs to be the msg.sender.
    /// @param hashes Array of git commit hashes to receive tokens. This hash will be used to
    ///     look up the address that was embedded in the commit data's message. MUST equal
    ///     length of `values`. hashes[i]'s owner will be rewarded with values[i] tokens.
    /// @param values Array of amounts of tokens to be given to each commit owner. MUST
    ///     equal length of `hashes`. values[i] is the amount minted for hashes[i]'s owner.
    /// @return tagHash The SHA-1 built from the tag data.
    /// @dev The usual case here is that hashes refers to all the git commits included from the last
    ///     release tag (vX.Y.Z-1) to the newest release tag (vX.Y.Z) being added. All of the commit
    ///     hashes SHOULD have already been added previously via `addCommit()`,
    function addRelease(
        TagData calldata tagData,
        bytes20[] calldata hashes,
        uint256[] calldata values
    ) external returns (bytes20 tagHash);

    /// @notice Get the owner address of a git commit.
    /// @param commitHash The hash of the git commit. If the commit that generated this hash does
    ///     not exist, it means that no corresponding commit was ever added to the contract.
    /// @return ownerAddr The address of the owner of the commit. This is equal to the address
    ///     that was included in the commit message. If this commit hash was not notarized
    ///     via `addCommit()`, then the address returned is a zero address.
    function commitAddr(bytes20 commitHash) external view returns (address ownerAddr);

    /// @notice Check if a commit hash exists, indicating that the corresponding commit has been
    ///     notarized in the contract via `addCommit()` previously.
    /// @param commitHash The hash of the git commit.
    /// @return exists `true` if the commit hash exists, `false` otherwise.
    function commitExists(bytes20 commitHash) external view returns (bool exists);

    /// @notice Get the token address of a git tag.
    /// @param tagHash The hash of the git tag. If the tag that generated this hash does not exist,
    ///     it means that no corresponding release was ever added to the contract.
    /// @return tokenAddr The address of the token in the tag message. If this release was not
    ///     notarized via `addRelease()`, then the address returned is a zero address.
    function tagAddr(bytes20 tagHash) external view returns (address tokenAddr);

    /// @notice Check if a tag hash exists, indicating that the corresponding release has been
    ///     notarized in the contract via `addRelease()` previously.
    /// @param tagHash The hash of the git tag.
    /// @return exists `true` if the tag hash exists, `false` otherwise.
    function tagExists(bytes20 tagHash) external view returns (bool exists);
}
