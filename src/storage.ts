// storage.ts — encrypted-at-rest persistence for credit profiles.
//
// The port (`ProfileStore`) is what the service depends on. The in-memory impl is
// for dev/tests. For production, back it with Postgres/DynamoDB and keep the same
// rule: PII (account numbers) is already field-encrypted in the model; treat the
// whole record as sensitive, restrict access by role, and log access, not data.

import { CreditProfile } from "./types";

export interface StoredProfile {
  profile: CreditProfile;
  wrappedDataKey: string; // per-record key, wrapped by the master key (see crypto.ts)
}

export interface ProfileStore {
  put(p: StoredProfile): Promise<void>;
  get(consumerId: string): Promise<StoredProfile | null>;
  list(): Promise<string[]>;
}

export class InMemoryProfileStore implements ProfileStore {
  private m = new Map<string, StoredProfile>();
  async put(p: StoredProfile) { this.m.set(p.profile.consumerId, p); }
  async get(consumerId: string) { return this.m.get(consumerId) ?? null; }
  async list() { return [...this.m.keys()]; }
}
