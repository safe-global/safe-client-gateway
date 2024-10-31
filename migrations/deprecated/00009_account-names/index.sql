CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE accounts
ADD COLUMN name bytea,
ADD COLUMN name_hash varchar(64);

-- Default values are set to avoid NULL values in the already existing accounts.
UPDATE accounts
SET name = gen_random_bytes(16),
    name_hash = encode(gen_random_bytes(32), 'hex')
WHERE name IS NULL OR name_hash IS NULL;

-- Once the default values are set, the columns are set to NOT NULL.
ALTER TABLE accounts
ALTER COLUMN name SET NOT NULL,
ALTER COLUMN name_hash SET NOT NULL,
ADD CONSTRAINT name_hash_unique UNIQUE (name_hash);
