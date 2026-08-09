# EduTrust AI architecture

## Credential issuance

1. An authorised institution creates a credential from its private student record.
2. The application canonicalises the approved fields and hashes the credential ID and document.
3. The PDF and private record remain in encrypted off-chain storage.
4. `EduTrustRegistry.issueCredential` anchors only the hashes, issuer and timestamp to BOT Chain.
5. The graduate receives the PDF, credential ID and a public verification URL.

## Verification

1. A verifier scans a QR code, enters an ID or uploads a document.
2. The public service hashes the credential ID and reads the canonical on-chain status.
3. For document checks, OCR extracts the visible claims and the service rebuilds the document fingerprint.
4. The result reports valid, revoked, unknown or altered without exposing private student records.

## Trust boundaries

| Boundary | Responsibility |
| --- | --- |
| BOT Chain | Immutable credential fingerprint, issuer and lifecycle status |
| Institution database | Student identity, academic results and issuer audit trail |
| Private object storage | Original PDFs and generated credential assets |
| AI/OCR service | Claim extraction and difference explanation |
| Public verifier | Minimal disclosure of approved credential claims |

## Contract roles

- `DEFAULT_ADMIN_ROLE`: approves and removes institution issuer wallets.
- `ISSUER_ROLE`: issues credentials and revokes credentials issued by that wallet.
- Public users: read and compare credential fingerprints without authentication.
