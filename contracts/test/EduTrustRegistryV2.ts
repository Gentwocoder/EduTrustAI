import { expect } from "chai";
import { network } from "hardhat";

describe("EduTrustRegistryV2", function () {
  async function deployFixture() {
    const { ethers } = await network.create();
    const [admin, recovery, newAdmin, institution, outsider] = await ethers.getSigners();
    const registry = await ethers.deployContract("EduTrustRegistryV2", [
      admin.address,
      recovery.address,
    ]);
    await registry.grantRole(await registry.ISSUER_ROLE(), institution.address);
    return { ethers, registry, admin, recovery, newAdmin, institution, outsider };
  }

  it("issues credentials with an optional expiry while preserving the V1 read shape", async function () {
    const { ethers, registry, institution } = await deployFixture();
    const latest = await ethers.provider.getBlock("latest");
    const expiresAt = BigInt((latest?.timestamp ?? 0) + 3_600);
    const credentialIdHash = ethers.id("EDU-2026-EXPIRING");
    const documentHash = ethers.id("private-document");

    await registry.connect(institution)[
      "issueCredential(bytes32,bytes32,uint64)"
    ](credentialIdHash, documentHash, expiresAt);

    const record = await registry.getCredential(credentialIdHash);
    const lifecycle = await registry.getCredentialLifecycle(credentialIdHash);
    expect(record.documentHash).to.equal(documentHash);
    expect(record.status).to.equal(1n);
    expect(lifecycle.expiresAt).to.equal(expiresAt);
  });

  it("renews a valid credential by linking a replacement without calling it misconduct", async function () {
    const { ethers, registry, institution } = await deployFixture();
    const original = ethers.id("EDU-2026-ORIGINAL");
    const replacement = ethers.id("EDU-2027-RENEWED");
    await registry.connect(institution)["issueCredential(bytes32,bytes32)"](original, ethers.id("document-v1"));

    await expect(
      registry.connect(institution).renewCredential(
        original,
        replacement,
        ethers.id("document-v2"),
        0,
      ),
    ).to.emit(registry, "CredentialRenewed");

    const oldRecord = await registry.getCredential(original);
    const oldLifecycle = await registry.getCredentialLifecycle(original);
    const newLifecycle = await registry.getCredentialLifecycle(replacement);
    expect(oldRecord.status).to.equal(4n);
    expect(oldLifecycle.replacement).to.equal(replacement);
    expect(newLifecycle.supersedes).to.equal(original);
  });

  it("records corrections as a replacement lifecycle event", async function () {
    const { ethers, registry, institution } = await deployFixture();
    const original = ethers.id("EDU-2026-TYPO");
    const replacement = ethers.id("EDU-2026-CORRECTED");
    await registry.connect(institution)["issueCredential(bytes32,bytes32)"](original, ethers.id("wrong-document"));

    await expect(
      registry.connect(institution).correctCredential(
        original,
        replacement,
        ethers.id("correct-document"),
        0,
      ),
    ).to.emit(registry, "CredentialCorrected");
  });

  it("requires the issuer or administrator to replace a credential", async function () {
    const { ethers, registry, institution, outsider } = await deployFixture();
    const original = ethers.id("EDU-2026-CONTROLLED");
    await registry.connect(institution)["issueCredential(bytes32,bytes32)"](original, ethers.id("document"));

    await expect(
      registry.connect(outsider).renewCredential(
        original,
        ethers.id("replacement"),
        ethers.id("replacement-document"),
        0,
      ),
    ).to.revert(ethers);
  });

  it("rotates a compromised administrator through a recovery wallet", async function () {
    const { registry, admin, recovery, newAdmin } = await deployFixture();
    const adminRole = await registry.DEFAULT_ADMIN_ROLE();

    await expect(registry.connect(recovery).proposeAdminRotation(newAdmin.address))
      .to.emit(registry, "AdminRotationProposed");
    await expect(registry.connect(newAdmin).acceptAdminRotation())
      .to.emit(registry, "AdminRotated");

    expect(await registry.primaryAdmin()).to.equal(newAdmin.address);
    expect(await registry.hasRole(adminRole, newAdmin.address)).to.equal(true);
    expect(await registry.hasRole(adminRole, admin.address)).to.equal(false);
    expect(await registry.hasRole(await registry.ISSUER_ROLE(), admin.address)).to.equal(false);
  });
});
