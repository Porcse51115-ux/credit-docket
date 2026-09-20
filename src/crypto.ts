// crypto.ts — field-level encryption for PII at rest.
//
// Pattern: envelope encryption. A master key (from a KMS in production; from env
// in dev) protects a per-record data key, and the data key protects field values
// with AES-256-GCM. GCM gives us authentication, so tampering is detected on read.
//
// In production, replace LocalMasterKey with a real KMS (AWS KMS, GCP KMS, Vault).
// Never let plaintext credit data or full account numbers touch logs or disk.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

export interface MasterKeyProvider {
  /** Encrypt a freshly generated 32-byte data key. */
  wrap(dataKey: Buffer): Promise<string>;
  /** Recover the data key. */
  unwrap(wrapped: string): Promise<Buffer>;
}

/** Dev-only master key from env. Swap for KMS in production. */
export class LocalMasterKey implements MasterKeyProvider {
  private key: Buffer;
  constructor(base64Key = process.env.FIELD_MASTER_KEY) {
    if (!base64Key) {
      throw new Error(
        "FIELD_MASTER_KEY is required. Generate one: " +
          "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
      );
    }
    this.key = Buffer.from(base64Key, "base64");
    if (this.key.length !== 32) throw new Error("FIELD_MASTER_KEY must decode to 32 bytes");
  }
  async wrap(dataKey: Buffer): Promise<string> {
    return seal(this.key, dataKey).serialize();
  }
  async unwrap(wrapped: string): Promise<Buffer> {
    return open(this.key, Sealed.parse(wrapped));
  }
}

class Sealed {
  constructor(public iv: Buffer, public tag: Buffer, public ct: Buffer) {}
  serialize(): string {
    return [this.iv, this.tag, this.ct].map((b) => b.toString("base64")).join(".");
  }
  static parse(s: string): Sealed {
    const [iv, tag, ct] = s.split(".").map((p) => Buffer.from(p, "base64"));
    if (!iv || !tag || !ct) throw new Error("malformed ciphertext");
    return new Sealed(iv, tag, ct);
  }
}

function seal(key: Buffer, plaintext: Buffer): Sealed {
  const iv = randomBytes(12);
  const c = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([c.update(plaintext), c.final()]);
  return new Sealed(iv, c.getAuthTag(), ct);
}

function open(key: Buffer, s: Sealed): Buffer {
  const d = createDecipheriv(ALGO, key, s.iv);
  d.setAuthTag(s.tag);
  return Buffer.concat([d.update(s.ct), d.final()]);
}

/** Encrypts individual string fields under a per-record data key. */
export class FieldCrypto {
  constructor(private master: MasterKeyProvider) {}

  async newRecordKey(): Promise<{ wrapped: string; key: Buffer }> {
    const key = randomBytes(32);
    return { wrapped: await this.master.wrap(key), key };
  }

  encryptField(dataKey: Buffer, value: string): string {
    return seal(dataKey, Buffer.from(value, "utf8")).serialize();
  }

  decryptField(dataKey: Buffer, sealed: string): string {
    return open(dataKey, Sealed.parse(sealed)).toString("utf8");
  }

  async decryptWithWrappedKey(wrapped: string, sealed: string): Promise<string> {
    const key = await this.master.unwrap(wrapped);
    return this.decryptField(key, sealed);
  }
}

/** Mask an account number for display: keep last 4. */
export function maskAccount(full: string): string {
  const digits = full.replace(/\s+/g, "");
  if (digits.length <= 4) return "****";
  return "****" + digits.slice(-4);
}
