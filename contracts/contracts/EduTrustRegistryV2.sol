// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title EduTrustRegistryV2
/// @notice Privacy-preserving academic registry with lifecycle replacement and recoverable administration.
/// @dev Deploy separately from V1. Existing V1 records remain readable at their original contract.
contract EduTrustRegistryV2 is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant RECOVERY_ROLE = keccak256("RECOVERY_ROLE");

    enum CredentialStatus {
        Unknown,
        Valid,
        Revoked,
        Expired,
        Replaced
    }

    struct Credential {
        // The first five fields retain the V1 read order.
        bytes32 documentHash;
        address issuer;
        uint64 issuedAt;
        uint64 revokedAt;
        CredentialStatus status;
        uint64 expiresAt;
        bytes32 supersedes;
        bytes32 replacement;
    }

    mapping(bytes32 credentialIdHash => Credential credential) private credentials;

    address public primaryAdmin;
    address public pendingAdmin;

    error CredentialAlreadyExists(bytes32 credentialIdHash);
    error CredentialNotFound(bytes32 credentialIdHash);
    error CredentialAlreadyRevoked(bytes32 credentialIdHash);
    error CredentialNotActive(bytes32 credentialIdHash);
    error InvalidExpiry(uint64 expiresAt);
    error EmptyHash();
    error InvalidAdmin();
    error NotPendingAdmin(address account);

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
    event CredentialRenewed(
        bytes32 indexed credentialIdHash,
        bytes32 indexed replacementCredentialIdHash,
        address indexed executedBy,
        uint64 renewedAt
    );
    event CredentialCorrected(
        bytes32 indexed credentialIdHash,
        bytes32 indexed replacementCredentialIdHash,
        address indexed executedBy,
        uint64 correctedAt
    );
    event AdminRotationProposed(
        address indexed currentAdmin,
        address indexed pendingAdmin,
        address indexed proposedBy
    );
    event AdminRotated(address indexed previousAdmin, address indexed newAdmin);

    constructor(address initialAdmin, address recoveryAdmin) {
        if (initialAdmin == address(0) || recoveryAdmin == address(0)) revert InvalidAdmin();
        primaryAdmin = initialAdmin;
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ISSUER_ROLE, initialAdmin);
        _grantRole(RECOVERY_ROLE, recoveryAdmin);
    }

    function contractVersion() external pure returns (uint8) {
        return 2;
    }

    function issueCredential(bytes32 credentialIdHash, bytes32 documentHash)
        external
        onlyRole(ISSUER_ROLE)
    {
        _issueCredential(credentialIdHash, documentHash, 0, msg.sender, bytes32(0));
    }

    function issueCredential(bytes32 credentialIdHash, bytes32 documentHash, uint64 expiresAt)
        external
        onlyRole(ISSUER_ROLE)
    {
        _issueCredential(credentialIdHash, documentHash, expiresAt, msg.sender, bytes32(0));
    }

    function revokeCredential(bytes32 credentialIdHash, bytes32 reasonHash)
        external
        onlyRole(ISSUER_ROLE)
    {
        Credential storage credential = credentials[credentialIdHash];
        if (credential.status == CredentialStatus.Unknown) revert CredentialNotFound(credentialIdHash);
        if (credential.status == CredentialStatus.Revoked) revert CredentialAlreadyRevoked(credentialIdHash);
        _requireController(credential);
        if (_effectiveStatus(credential) != CredentialStatus.Valid) {
            revert CredentialNotActive(credentialIdHash);
        }

        credential.status = CredentialStatus.Revoked;
        credential.revokedAt = uint64(block.timestamp);
        emit CredentialRevoked(credentialIdHash, msg.sender, reasonHash, credential.revokedAt);
    }

    function renewCredential(
        bytes32 credentialIdHash,
        bytes32 replacementCredentialIdHash,
        bytes32 replacementDocumentHash,
        uint64 expiresAt
    ) external onlyRole(ISSUER_ROLE) {
        _replaceCredential(
            credentialIdHash,
            replacementCredentialIdHash,
            replacementDocumentHash,
            expiresAt
        );
        emit CredentialRenewed(
            credentialIdHash,
            replacementCredentialIdHash,
            msg.sender,
            uint64(block.timestamp)
        );
     }

    function correctCredential(
        bytes32 credentialIdHash,
        bytes32 replacementCredentialIdHash,
        bytes32 replacementDocumentHash,
        uint64 expiresAt
    ) external onlyRole(ISSUER_ROLE) {
        _replaceCredential(
            credentialIdHash,
            replacementCredentialIdHash,
            replacementDocumentHash,
            expiresAt
        );
        emit CredentialCorrected(
            credentialIdHash,
            replacementCredentialIdHash,
            msg.sender,
            uint64(block.timestamp)
        );
     }

    /// @notice V1-compatible canonical read.
    function getCredential(bytes32 credentialIdHash)
        external
        view
        returns (
            bytes32 documentHash,
            address issuer,
            uint64 issuedAt,
            uint64 revokedAt,
            CredentialStatus status
        )
    {
        Credential storage credential = credentials[credentialIdHash];
        return (
            credential.documentHash,
            credential.issuer,
            credential.issuedAt,
            credential.revokedAt,
            _effectiveStatus(credential)
        );
    }

    function getCredentialLifecycle(bytes32 credentialIdHash)
        external
        view
        returns (
            uint64 expiresAt,
            bytes32 supersedes,
            bytes32 replacement,
            CredentialStatus effectiveStatus
        )
    {
        Credential storage credential = credentials[credentialIdHash];
        return (
            credential.expiresAt,
            credential.supersedes,
            credential.replacement,
            _effectiveStatus(credential)
        );
    }

    function verifyCredential(bytes32 credentialIdHash, bytes32 suppliedDocumentHash)
        external
        view
        returns (bool hashMatches, CredentialStatus status, address issuer, uint64 issuedAt)
    {
        Credential storage credential = credentials[credentialIdHash];
        CredentialStatus effectiveStatus = _effectiveStatus(credential);
        return (
            effectiveStatus != CredentialStatus.Unknown &&
                credential.documentHash == suppliedDocumentHash,
            effectiveStatus,
            credential.issuer,
            credential.issuedAt
        );
    }

    /// @notice Propose a new primary administrator. A recovery role should be held by a multisig.
    function proposeAdminRotation(address newAdmin) external {
        if (
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender) &&
            !hasRole(RECOVERY_ROLE, msg.sender)
        ) {
            revert AccessControlUnauthorizedAccount(msg.sender, DEFAULT_ADMIN_ROLE);
        }
        if (newAdmin == address(0) || newAdmin == primaryAdmin) revert InvalidAdmin();
        pendingAdmin = newAdmin;
        emit AdminRotationProposed(primaryAdmin, newAdmin, msg.sender);
    }

    /// @notice The proposed wallet must accept before the old administrator is removed.
    function acceptAdminRotation() external {
        if (msg.sender != pendingAdmin) revert NotPendingAdmin(msg.sender);
        address previousAdmin = primaryAdmin;
        address newAdmin = pendingAdmin;
        pendingAdmin = address(0);
        primaryAdmin = newAdmin;

        _grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
        _grantRole(ISSUER_ROLE, newAdmin);
        _revokeRole(ISSUER_ROLE, previousAdmin);
        _revokeRole(DEFAULT_ADMIN_ROLE, previousAdmin);

        emit AdminRotated(previousAdmin, newAdmin);
    }

    function _replaceCredential(
        bytes32 credentialIdHash,
        bytes32 replacementCredentialIdHash,
        bytes32 replacementDocumentHash,
        uint64 expiresAt
    ) private {
        Credential storage credential = credentials[credentialIdHash];
        if (credential.status == CredentialStatus.Unknown) revert CredentialNotFound(credentialIdHash);
        _requireController(credential);
        if (_effectiveStatus(credential) != CredentialStatus.Valid) {
            revert CredentialNotActive(credentialIdHash);
        }

        _issueCredential(
            replacementCredentialIdHash,
            replacementDocumentHash,
            expiresAt,
            credential.issuer,
            credentialIdHash
        );
        credential.status = CredentialStatus.Replaced;
        credential.replacement = replacementCredentialIdHash;
    }

    function _issueCredential(
        bytes32 credentialIdHash,
        bytes32 documentHash,
        uint64 expiresAt,
        address issuer,
        bytes32 supersedes
    ) private {
        if (credentialIdHash == bytes32(0) || documentHash == bytes32(0)) revert EmptyHash();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidExpiry(expiresAt);
        if (credentials[credentialIdHash].status != CredentialStatus.Unknown) {
            revert CredentialAlreadyExists(credentialIdHash);
        }

        uint64 issuedAt = uint64(block.timestamp);
        credentials[credentialIdHash] = Credential({
            documentHash: documentHash,
            issuer: issuer,
            issuedAt: issuedAt,
            revokedAt: 0,
            status: CredentialStatus.Valid,
            expiresAt: expiresAt,
            supersedes: supersedes,
            replacement: bytes32(0)
        });
        emit CredentialIssued(credentialIdHash, documentHash, issuer, issuedAt);
    }

    function _requireController(Credential storage credential) private view {
        if (
            credential.issuer != msg.sender &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) {
            revert AccessControlUnauthorizedAccount(msg.sender, ISSUER_ROLE);
        }
    }

    function _effectiveStatus(Credential storage credential)
        private
        view
        returns (CredentialStatus)
    {
        if (
            credential.status == CredentialStatus.Valid &&
            credential.expiresAt != 0 &&
            block.timestamp >= credential.expiresAt
        ) {
            return CredentialStatus.Expired;
        }
        return credential.status;
    }
}
