export interface Config {
  port: number;
  passTypeIdentifier: string;
  teamIdentifier: string;
  organizationName: string;
  /** The pass management API requires `Authorization: Bearer <token>`. */
  apiToken: string;
  passTtlSeconds: number;
  /** Byte ceiling for the in-memory signed-pass store. Oldest entries evict first. */
  passStoreMaxBytes: number;
  /** Public origin stamped into updatable passes as webServiceURL, e.g. https://pass.abdeen.dev */
  publicBaseUrl?: string;
  /** Where the SQLite database lives. Mount a Railway volume here. */
  dataDir: string;
  /** Token-based APNs credentials for pass-update pushes. Both or neither. */
  apns?: {
    keyId: string;
    key: Buffer;
  };
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

  const apnsKeyId = process.env.APNS_KEY_ID;
  const apnsKeyBase64 = process.env.APNS_KEY_BASE64;
  if (Boolean(apnsKeyId) !== Boolean(apnsKeyBase64)) {
    throw new Error(
      "APNS_KEY_ID and APNS_KEY_BASE64 must be set together (or both left unset)."
    );
  }

  const config: Config = {
    port: Number(process.env.PORT) || 3000,
    passTypeIdentifier: required("PASS_TYPE_IDENTIFIER"),
    teamIdentifier: required("TEAM_IDENTIFIER"),
    organizationName: process.env.ORGANIZATION_NAME || "Pocketful",
    apiToken: required("API_TOKEN"),
    passTtlSeconds: Number(process.env.PASS_TTL_SECONDS) || 900,
    passStoreMaxBytes:
      Number(process.env.PASS_STORE_MAX_BYTES) || 128 * 1024 * 1024,
    publicBaseUrl: process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "") || undefined,
    dataDir: process.env.DATA_DIR || `${process.cwd()}/data`,
    apns:
      apnsKeyId && apnsKeyBase64
        ? { keyId: apnsKeyId, key: Buffer.from(apnsKeyBase64, "base64") }
        : undefined,
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

  if (config.apns && !config.apns.key.toString("utf8").includes("-----BEGIN")) {
    throw new Error(
      "APNS_KEY_BASE64 does not decode to a .p8 key. It must be the base64 of " +
        "the whole AuthKey_XXXXXXXXXX.p8 file (e.g. `base64 -i AuthKey.p8`)."
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
