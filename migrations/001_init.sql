-- Encrypted credit profiles. The `profile` JSONB already contains field-level
-- encrypted account numbers (accountNumberEnc); `wrapped_data_key` is the
-- per-record data key, itself wrapped by your KMS master key. So a database
-- compromise alone does NOT expose account numbers without the KMS key.
-- Still: enable disk/volume encryption at rest and restrict access by role.
CREATE TABLE IF NOT EXISTS credit_profiles (
  consumer_id      TEXT PRIMARY KEY,
  wrapped_data_key TEXT        NOT NULL,
  profile          JSONB       NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_profiles_updated_at_idx
  ON credit_profiles (updated_at DESC);
