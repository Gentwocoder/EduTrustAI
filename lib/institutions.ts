export type InstitutionProfile = {
  id: string;
  name: string;
  category: string;
  wallet: string;
  website?: string;
  country?: string;
  verified: true;
  verificationMethod: string;
};

const builtInProfiles: InstitutionProfile[] = [
  {
    id: "edutrust-registry",
    name: "EduTrust Registry Administration",
    category: "Platform operator",
    wallet: "0xAc7052141497866a8e3048B5Bb7a30c6418b5567",
    website: "https://edu-trust-ai.vercel.app",
    country: "Nigeria",
    verified: true,
    verificationMethod: "Registry administrator wallet",
  },
];

function configuredProfiles() {
  const value = process.env.EDUTRUST_INSTITUTION_PROFILES_JSON;
  if (!value) return [];

  try {
    const profiles = JSON.parse(value) as InstitutionProfile[];
    return profiles.filter((profile) => (
      profile &&
      typeof profile.name === "string" &&
      typeof profile.wallet === "string" &&
      profile.verified === true
    ));
  } catch {
    console.warn("EDUTRUST_INSTITUTION_PROFILES_JSON is not valid JSON.");
    return [];
  }
}

export function institutionProfiles() {
  const byWallet = new Map<string, InstitutionProfile>();
  for (const profile of [...builtInProfiles, ...configuredProfiles()]) {
    byWallet.set(profile.wallet.toLowerCase(), profile);
  }
  return [...byWallet.values()];
}

export function institutionProfileForWallet(wallet: string) {
  return institutionProfiles().find(
    (profile) => profile.wallet.toLowerCase() === wallet.toLowerCase(),
  ) ?? null;
}
