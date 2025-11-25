ALTER TABLE targeted_safes
    ADD COLUMN chain_id VARCHAR(32) NULL;

-- Drop the existing unique constraint
ALTER TABLE targeted_safes
    DROP CONSTRAINT unique_targeted_safe;

-- Create a new unique constraint that includes chain_id when present
-- This uses a partial unique index to handle the nullable chain_id
CREATE UNIQUE INDEX unique_targeted_safe_with_chain
    ON targeted_safes (address, outreach_id, chain_id)
    WHERE chain_id IS NOT NULL;

-- Create a unique index for rows without chain_id
CREATE UNIQUE INDEX unique_targeted_safe_without_chain
    ON targeted_safes (address, outreach_id)
    WHERE chain_id IS NULL;
