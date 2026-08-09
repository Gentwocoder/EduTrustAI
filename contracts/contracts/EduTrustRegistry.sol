// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title EduTrustRegistry
/// @notice Privacy-preserving registry for academic credential fingerprints.
/// @dev No student names, grades, documents, or other personal data belong on-chain.
contract EduTrustRegistry is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    enum CredentialStatus {
        Unknown,
        Valid,
        Revoked
    }

    struct Credential {
        bytes32 documentHash;
        address issuer;
        uint64 issuedAt;
        uint64 revokedAt;
        CredentialStatus status;
    }

    mapping(bytes32 credentialIdHash => Credential credential) private credentials;

    error CredentialAlreadyExists(bytes32 credentialIdHash);
    error CredentialNotFound(bytes32 credentialIdHash);
    error CredentialAlreadyRevoked(bytes32 credentialIdHash);
    error EmptyHash();
    error InvalidAdmin();

    event CredentialIssued(
        bytes32 indexed credentialIdHash,
        bytes32 indexed documentHash,
        address indexed issuer,
        uint64 issuedAt
    );

    event CredentialRevoked(
        bytes32 indexed credentialIdHash,
        address indexed revokedBy,
        bytes32 indexed reasonHash,
        uint64 revokedAt
    );

    constructor(address initialAdmin) {
        if (initialAdmin == address(0)) revert InvalidAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ISSUER_ROLE, initialAdmin);
    }

    /// @notice Register a credential using hashes produced off-chain.
    function issueCredential(bytes32 credentialIdHash, bytes32 documentHash) external onlyRole(ISSUER_ROLE) {
        if (credentialIdHash == bytes32(0) || documentHash == bytes32(0)) revert EmptyHash();
        if (credentials[credentialIdHash].status != CredentialStatus.Unknown) {
            revert CredentialAlreadyExists(credentialIdHash);
        }

        uint64 issuedAt = uint64(block.timestamp);
        credentials[credentialIdHash] = Credential({
            documentHash: documentHash,
            issuer: msg.sender,
            issuedAt: issuedAt,
            revokedAt: 0,
            status: CredentialStatus.Valid
        });

        emit CredentialIssued(credentialIdHash, documentHash, msg.sender, issuedAt);
    }

    /// @notice Revoke a credential without publishing the human-readable reason.
    function revokeCredential(bytes32 credentialIdHash, bytes32 reasonHash) external onlyRole(ISSUER_ROLE) {
        Credential storage credential = credentials[credentialIdHash];
        if (credential.status == CredentialStatus.Unknown) revert CredentialNotFound(credentialIdHash);
        if (credential.status == CredentialStatus.Revoked) revert CredentialAlreadyRevoked(credentialIdHash);
        if (credential.issuer != msg.sender && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, ISSUER_ROLE);
        }

        credential.status = CredentialStatus.Revoked;
        credential.revokedAt = uint64(block.timestamp);

        emit CredentialRevoked(credentialIdHash, msg.sender, reasonHash, credential.revokedAt);
    }

    /// @notice Read the canonical state used by public verification clients.
    function getCredential(bytes32 credentialIdHash) external view returns (Credential memory) {
        return credentials[credentialIdHash];
    }

    /// @notice Compare a supplied document fingerprint with the canonical record.
    function verifyCredential(bytes32 credentialIdHash, bytes32 suppliedDocumentHash)
        external
        view
        returns (bool hashMatches, CredentialStatus status, address issuer, uint64 issuedAt)
    {
        Credential memory credential = credentials[credentialIdHash];
        return (
            credential.status != CredentialStatus.Unknown && credential.documentHash == suppliedDocumentHash,
            credential.status,
            credential.issuer,
            credential.issuedAt
        );
    }
}
