// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";

contract ProofChainCertificate is ERC721, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;

    struct CertificateData {
        string freelancerName;
        address freelancerWallet;
        string projectTitle;
        string projectDescription;
        string projectCompletionProof;
        bool clientApprovalStatus;
        uint256 completionTimestamp;
        string paymentTransactionHash;
        string metadataURI;
        uint256 mintTimestamp;
        string[] skillTags;
        string platformName;
    }

    struct CertificateInput {
        string freelancerName;
        address freelancerWallet;
        string projectTitle;
        string projectDescription;
        string projectCompletionProof;
        bool clientApprovalStatus;
        uint256 completionTimestamp;
        string paymentTransactionHash;
        string metadataURI;
        string[] skillTags;
        string platformName;
    }

    error TransfersDisabled();
    error InvalidFreelancerWallet();
    error EmptyMetadataURI();

    Counters.Counter private _tokenIds;
    mapping(uint256 => CertificateData) private _certificates;

    event CertificateMinted(uint256 indexed tokenId, address indexed freelancerWallet, string metadataURI);

    constructor() ERC721("ProofChain Certificate", "PCERT") {}

    function mintCertificate(address to, CertificateInput calldata input) external onlyOwner nonReentrant returns (uint256) {
        if (to == address(0) || input.freelancerWallet == address(0)) {
            revert InvalidFreelancerWallet();
        }

        if (bytes(input.metadataURI).length == 0) {
            revert EmptyMetadataURI();
        }

        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();

        _safeMint(to, tokenId);

        _certificates[tokenId] = CertificateData({
            freelancerName: input.freelancerName,
            freelancerWallet: input.freelancerWallet,
            projectTitle: input.projectTitle,
            projectDescription: input.projectDescription,
            projectCompletionProof: input.projectCompletionProof,
            clientApprovalStatus: input.clientApprovalStatus,
            completionTimestamp: input.completionTimestamp,
            paymentTransactionHash: input.paymentTransactionHash,
            metadataURI: input.metadataURI,
            mintTimestamp: block.timestamp,
            skillTags: input.skillTags,
            platformName: input.platformName
        });

        emit CertificateMinted(tokenId, to, input.metadataURI);
        return tokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireMinted(tokenId);
        return _certificates[tokenId].metadataURI;
    }

    function getCertificateData(uint256 tokenId) external view returns (CertificateData memory) {
        _requireMinted(tokenId);
        return _certificates[tokenId];
    }

    function verifyCertificate(uint256 tokenId) external view returns (bool valid, address owner_, string memory metadataURI) {
        if (!_exists(tokenId)) {
            return (false, address(0), "");
        }

        owner_ = ownerOf(tokenId);
        metadataURI = _certificates[tokenId].metadataURI;
        valid = owner_ != address(0) && bytes(metadataURI).length > 0;
    }

    function approve(address, uint256) public pure override {
        revert TransfersDisabled();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert TransfersDisabled();
    }

    function transferFrom(address, address, uint256) public pure override {
        revert TransfersDisabled();
    }

    function safeTransferFrom(address, address, uint256) public pure override {
        revert TransfersDisabled();
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert TransfersDisabled();
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal override {
        if (from != address(0) && to != address(0)) {
            revert TransfersDisabled();
        }

        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
}