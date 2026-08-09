import { expect } from "chai";
import { network } from "hardhat";

describe("EduTrustRegistry", function () {
  async function deployFixture() {
    const { ethers } = await network.create();
    const [admin, institution, outsider] = await ethers.getSigners();
    const registry = await ethers.deployContract("EduTrustRegistry", [admin.address]);
    await registry.grantRole(await registry.ISSUER_ROLE(), institution.address);
    return { ethers, registry, admin, institution, outsider };
  }

  it("issues and verifies a credential without storing personal data", async function () {
    const { ethers, registry, institution } = await deployFixture();
    const credentialIdHash = ethers.id("EDU-2026-00128");
    const documentHash = ethers.id("canonical-private-document");

    await expect(registry.connect(institution).issueCredential(credentialIdHash, documentHash))
      .to.emit(registry, "CredentialIssued");

    const [matches, status, issuer] = await registry.verifyCredential(credentialIdHash, documentHash);
    expect(matches).to.equal(true);
    expect(status).to.equal(1n);
    expect(issuer).to.equal(institution.address);
  });

  it("detects a different document fingerprint", async function () {
    const { ethers, registry, institution } = await deployFixture();
    const credentialIdHash = ethers.id("EDU-2026-00128");
    await registry.connect(institution).issueCredential(credentialIdHash, ethers.id("original"));

    const [matches] = await registry.verifyCredential(credentialIdHash, ethers.id("altered"));
    expect(matches).to.equal(false);
  });

  it("allows the issuing institution to revoke its credential", async function () {
    const { ethers, registry, institution } = await deployFixture();
    const credentialIdHash = ethers.id("EDU-2026-00128");
    const documentHash = ethers.id("original");
    await registry.connect(institution).issueCredential(credentialIdHash, documentHash);
    await expect(registry.connect(institution).revokeCredential(credentialIdHash, ethers.id("administrative-error")))
      .to.emit(registry, "CredentialRevoked");

    const [, status] = await registry.verifyCredential(credentialIdHash, documentHash);
    expect(status).to.equal(2n);
  });

  it("rejects issuance by an unauthorised wallet", async function () {
    const { ethers, registry, outsider } = await deployFixture();
    await expect(
      registry.connect(outsider).issueCredential(ethers.id("unknown"), ethers.id("document")),
    ).to.revert(ethers);
  });
});
