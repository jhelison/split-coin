// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TeamBalance {
    // Owner is always the parent contract
    address public owner;

    // Current list of withdrawn balances
    mapping(address => uint256) public withdrawn;

    // Balances tracking
    mapping(IERC20 => uint256) public totalBalance;

    // Team proportion
    mapping(address => uint8) public teamProportion;

    // Custom errors
    error NotOwner();
    error InvalidAddress(string message);
    error LengthMismatch(string message);
    error BadProportion(string message);
    error NoBalanceToWithdraw(string message);
    error NoUserProportion(string message);

    // Events
    event Withdrawn(address indexed user, IERC20 indexed erc20, uint256 amount);

    /**
     * @dev Constructor for TeamBalanceFactory
     * @param _team An array of team member addresses
     * @param _proportions An array of proportions corresponding to each team member
     * Requirements:
     * - `_team` and `_proportions` must have the same length.
     * - Sum of all proportions in `_proportions` must equal 100.
     */
    constructor(address[] memory _team, uint8[] memory _proportions) {
        // Set the ownership
        owner = msg.sender;

        // Check if team lengh is zero
        if (_team.length == 0)
            revert LengthMismatch("Team length must be bigger than 0");

        // Check the proportion
        if (_team.length != _proportions.length)
            revert LengthMismatch("Team and proportions length mismatch");

        // Register all the addresses and keep track of proportions
        uint8 totalProportion;
        for (uint8 i = 0; i < _team.length; i++) {
            if (_team[i] == address(0))
                revert InvalidAddress("Team member address cannot be zero");

            teamProportion[_team[i]] = _proportions[i];
            totalProportion = totalProportion + _proportions[i];
        }

        // Total proportion must be equal to 100
        if (totalProportion != 100)
            revert BadProportion("Total proportion must equal 100");
    }

    /**
     * @dev Modifier to check if the message sender is the owner.
     * Reverts with a NotOwner error if called by any account other than the owner.
     */
    modifier isOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /**
     * @dev Withdraws ERC20 tokens based on the user's proportion.
     * @param erc20 The ERC20 token to withdraw
     * Requirements:
     * - Only the owner can call this function.
     * - The caller must have a non-zero proportion.
     * - There must be a balance available to withdraw.
     */
    function withdrawERC20(IERC20 erc20, address _address) external isOwner {
        // Check the user proportion
        uint8 userProportion = teamProportion[_address];
        if (userProportion == 0)
            revert NoUserProportion("User has no proportion assigned");

        // Get the current balance
        uint256 newBalance = erc20.balanceOf(address(this));

        // TODO: Check for misbehavior

        // Revert if balance is zero
        uint256 availableBalance = _calculatebalance(
            erc20,
            newBalance,
            _address
        );
        if (availableBalance == 0)
            revert NoBalanceToWithdraw("No balance available to withdraw");

        // Post tx cleanup
        totalBalance[erc20] = totalBalance[erc20] + availableBalance;
        withdrawn[_address] = withdrawn[_address] + availableBalance;

        // Do the transfer in the end
        erc20.transfer(_address, availableBalance);

        emit Withdrawn(_address, erc20, availableBalance);
    }

    /**
     * @dev Returns the available balance to withdraw for the ERC20 token.
     * @param erc20 The ERC20 token to check the balance for
     * @return uint256 The amount available to withdraw
     */
    function balanceERC20(
        IERC20 erc20,
        address _address
    ) public view returns (uint256) {
        // Get the current balance
        uint256 newBalance = erc20.balanceOf(address(this));

        return _calculatebalance(erc20, newBalance, _address);
    }

    /**
     * @dev Internal function to calculate the available balance to withdraw.
     * @param erc20 The ERC20 token to check the balance for (0x0 is the contract eth balance)
     * @param newBalance The current balance of the token
     * @return uint256 The amount available to withdraw
     */
    function _calculatebalance(
        IERC20 erc20,
        uint256 newBalance,
        address _address
    ) internal view returns (uint256) {
        // Calculate the new balance based on the proportion
        uint256 balanceUntilNow = totalBalance[erc20] + newBalance;
        uint256 entitledAmount = (balanceUntilNow * teamProportion[_address]) /
            100;
        return entitledAmount - withdrawn[_address];
    }
}
