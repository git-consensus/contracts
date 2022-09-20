// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;

/// @title  IToken
/// @author Matt Stam (@mattstam)
/// @notice An ERC20 token that maps to a Git project. Allows for:
///         -  Releases to be gated behind proposals, with vote from token owners.
///         -  Git Consensus contract to mint new tokens for commit owners.
///         -  Initial distribution to be allocated on create.
///
/// @dev    Intent is to allow tokens to be able to be minted for commit owners. To achieve this
///         *securely*, implementations will need to take care of 2 things to operate under the
///         Git Consensus Protocol:
///
///         [1] Only appropriate addresses may call `mint()`, which in the case of the Git Consensus
///         Protocol, need to be at least the address of the GitConsensus contract. For typical
///         Git project usage, this should be the ONLY address.
///
///         [2] The `governor()` must refer to the intended caller to the GitConsensus contract,
///         which should be the Governor that handles proposals and executions for the token. If
///         the token implementation only allows this at initialization time (the case with
///         TokenImpl) then this governor address must be know ahead of time using address
///         prediction (e.g. CREATE2 usage such as in GovernorFactory).
///
///         The rationale behind [1] should be obvious, but [2] is a bit more subtle. Imagine the
///         scenario in which GitConsensus does NOT require `token.governor()` to be the caller:
//
///         Step 1: Badguy deploys a governor with it's `governor.token()` pointing to an already
///         existing real token. This governor implementation will also disregard a normal proposal
///         system (e.g. it executes functions immediately if Badguy calls `governor.execute()`).
///
///         Step 2: Badguy calls `addCommit()` with some commit messages that include Badguy's
///         wallet address.
///
///         Step 3: Badguy calls `governor.execute()` to `addRelease()` with a tag message that
///         includes to Badguy's governor address, and with a distribution that includes the
///         commit hashes from Step 2.
///
///         The GitConsensus contract would mint these tokens to Badguy's wallet address.
///
///         **Solution**: The IToken's govAddr can only be the caller to `addRelease()`, therefor
///         when Badguy creates a new Governor in Step 2, his new governor will have the
///         transaction reverted.
interface IToken {
    /// @notice Initializes the ERC20 Token contract.
    /// @param govAddr Address of the corresponding governor contract. Recommended usage is
    ///    use address prediction to create the Token first, then create the Governor with
    ///    this Token's address as the `tokenAddr` parameter.
    /// @param minterAddr Address of the contract that will be able to mint new tokens. Should
    ///    always be set to the Git Consensus contract's address.
    /// @param name Name of the token (e.g. "MyToken").
    /// @param symbol Symbol of the token (e.g. "MTK").
    /// @param owners Array of addresses to receive an initial distribution of tokens. MUST
    ///     equal length of `values`.
    /// @param values Array of amounts of tokens to be given to each owner (in wei). The initial
    ///     token supply will be equal to the sum of all `values`. MUST equal length of `owners`.
    /// @dev The `owners` and `values` array input is similar in format and usage to IGitConsensus
    ///     `addRelease()`, with the difference being that the git commit hash -> address mapping
    ///     is skipped, which allows addresses to be directly specified for initial ownership.
    ///
    ///     If no initial distribution is desired, these arrays should be empty. In this case,
    ///     anybody will be able to make the first proposal and execute it to addRelease(), in
    ///     which they can define any distribution they want. So it's recommended to always just
    ///     do an initial distribution here, even if token values are extremely low.
    function initialize(
        address govAddr,
        address minterAddr,
        string calldata name,
        string calldata symbol,
        address[] calldata owners,
        uint256[] calldata values
    ) external;

    /// @notice Returns the governor that is corresponds with this token.
    /// @return govAddr The governor address.
    /// @dev Assumes a 1:1 mapping between governor and token, which is not always the case with
    ///     typical DAO usage. However, this is essential for tokens that want to be compatible
    ///     the Git Consensus Protocol.
    function govAddr() external returns (address govAddr);

    /// @notice Creates `amount` tokens and assigns them to `account`, increasing the total supply.
    /// @param account The address to assign the newly minted tokens to.
    /// @param amount The amount of tokens to be minted.
    function mint(address account, uint256 amount) external;
}
