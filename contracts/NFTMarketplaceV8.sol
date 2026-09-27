// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HOJNFTMarketplaceV7} from "./NFTMarketplaceV7.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @notice Lists multiple ERC-721 tokens from one collection in one transaction.
/// A collection-wide approval remains a separate, one-time NFT contract transaction.
contract HOJNFTMarketplaceV8 is HOJNFTMarketplaceV7 {
    error EmptyBatch();

    constructor(address treasury) HOJNFTMarketplaceV7(treasury) {}

    function marketplaceVersion() external pure override returns (uint256) { return 8; }

    function batchList(address nftAddress, uint256[] calldata tokenIds, uint256[] calldata prices) external {
        if (tokenIds.length == 0) revert EmptyBatch();
        if (tokenIds.length != prices.length) revert ArrayLengthMismatch();
        if (!IERC721(nftAddress).isApprovedForAll(msg.sender, address(this))) revert MarketplaceNotApproved();
        for (uint256 i; i < tokenIds.length; ++i) {
            _listItem(msg.sender, nftAddress, tokenIds[i], prices[i]);
        }
    }
}
