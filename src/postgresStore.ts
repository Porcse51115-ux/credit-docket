// postgresStore.ts — durable ProfileStore backed by Postgres.
//
// Takes a `pg` Pool via the constructor (dependency injection) so it can be
// tested against pg-mem and run against real Postgres without code changes.
// The stored profile keeps account numbers field-encrypted; the wrapped data
// key lives in its own column. See migrations/001_init.sql for the schema and
// the security notes.

import type { Pool } from "pg";
import { ProfileStore, StoredProfile } from "./storage";
import { CreditProfile } from "./types";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS credit_profiles (
  consumer_id      TEXT PRIMARY KEY,
  wrapped_data_key TEXT        NOT NULL,
  profile          JSONB       NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);`;

export class PostgresProfileStore implements ProfileStore {
  constructor(private pool: Pool) {}

  /** Idempotent; safe to call on boot. For real migrations, use the SQL file. */
  async ensureSchema(): Promise<void> {
    await this.pool.query(SCHEMA);
  }

  async put(p: StoredProfile): Promise<void> {
    await this.pool.query(
      `INSERT INTO credit_profiles (consumer_id, wrapped_data_key, profile, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (consumer_id) DO UPDATE
         SET wrapped_data_key = EXCLUDED.wrapped_data_key,
             profile          = EXCLUDED.profile,
             updated_at       = now()`,
      [p.profile.consumerId, p.wrappedDataKey, JSON.stringify(p.profile)]
    );
  }

  async get(consumerId: string): Promise<StoredProfile | null> {
    const r = await this.pool.query(
      `SELECT wrapped_data_key, profile FROM credit_profiles WHERE consumer_id = $1`,
      [consumerId]
    );
    if (r.rowCount === 0) return null;
    const row = r.rows[0] as { wrapped_data_key: string; profile: CreditProfile | string };
    // pg returns JSONB already parsed; pg-mem may hand back a string.
    const profile = typeof row.profile === "string" ? (JSON.parse(row.profile) as CreditProfile) : row.profile;
    return { profile, wrappedDataKey: row.wrapped_data_key };
  }

  async list(): Promise<string[]> {
    const r = await this.pool.query(
      `SELECT consumer_id FROM credit_profiles ORDER BY updated_at DESC`
    );
    return r.rows.map((x: { consumer_id: string }) => x.consumer_id);
  }
}
