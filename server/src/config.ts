export interface Config {
  port: number;
  passTypeIdentifier: string;
  teamIdentifier: string;
  organizationName: string;
  /** If set, POST /api/passes requires `Authorization: Bearer <token>` */
  apiToken?: string;
  passTtlSeconds: number;
  certs: {
    wwdr: Buffer;
    signerCert: Buffer;
    signerKey: Buffer;
    signerKeyPassphrase?: string;
  };
}

export function loadConfig(): Config {
  const missing: string[] = [];

  const required = (name: string): string => {
    const value = process.env[name];
    if (!value) {
      missing.push(name);
      return "";
    }
    return value;
  };

  const requiredB64 = (name: string): Buffer =>
    Buffer.from(required(name), "base64");

  const config: Config = {
    port: Number(process.env.PORT) || 3000,
    passTypeIdentifier: required("PASS_TYPE_IDENTIFIER"),
    teamIdentifier: required("TEAM_IDENTIFIER"),
    organizationName: process.env.ORGANIZATION_NAME || "Pocketful",
    apiToken: process.env.API_TOKEN || undefined,
    passTtlSeconds: Number(process.env.PASS_TTL_SECONDS) || 900,
    certs: {
      wwdr: requiredB64("WWDR_CERT_BASE64"),
      signerCert: requiredB64("SIGNER_CERT_BASE64"),
      signerKey: requiredB64("SIGNER_KEY_BASE64"),
      signerKeyPassphrase: process.env.SIGNER_KEY_PASSPHRASE || undefined,
    },
  };

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}.\n` +
        `See the "Certificates" section of INSTRUCTIONS.md for how to produce them.`
    );
  }

  for (const [name, buf] of Object.entries({
    WWDR_CERT_BASE64: config.certs.wwdr,
    SIGNER_CERT_BASE64: config.certs.signerCert,
    SIGNER_KEY_BASE64: config.certs.signerKey,
  })) {
    if (!buf.toString("utf8").includes("-----BEGIN")) {
      throw new Error(
        `${name} does not decode to a PEM file. It must be the base64 of the ` +
          `full .pem file (e.g. \`base64 -i wwdr.pem\`), not the certificate's own body.`
      );
    }
  }

  return config;
}
