ALTER TABLE targeted_safes
    ADD COLUMN chain_id VARCHAR(32) NULL;

-- Drop the existing unique constraint
ALTER TABLE targeted_safes
    DROP CONSTRAINT unique_targeted_safe;

-- Create unique constraint on (address, outreach_id, chain_id) treating NULL as distinct
-- This allows multiple different chain_id values for same address+outreach
CREATE UNIQUE INDEX unique_targeted_safe_with_chain
    ON targeted_safes (address, outreach_id, chain_id)
    WHERE chain_id IS NOT NULL;

-- Create unique constraint on (address, outreach_id) for NULL chain_id records
-- This allows only one NULL record per address+outreach
CREATE UNIQUE INDEX unique_targeted_safe_without_chain
    ON targeted_safes (address, outreach_id)
    WHERE chain_id IS NULL;

-- Create exclusion constraint to prevent mixing NULL and non-NULL chain_id
-- for the same address+outreach combination
-- Use CASE to convert boolean to integer (0 or 1) since GIST doesn't support boolean
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE targeted_safes
    ADD CONSTRAINT prevent_mixed_chain_id
    EXCLUDE USING gist (
        address WITH =,
        outreach_id WITH =,
        (CASE WHEN chain_id IS NULL THEN 0 ELSE 1 END) WITH <>
    );
