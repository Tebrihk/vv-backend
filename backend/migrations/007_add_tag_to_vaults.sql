-- Add tag column to vaults table
-- This column stores the vault category (e.g., Seed, Private, Advisors, Team)

ALTER TABLE vaults 
ADD COLUMN tag VARCHAR(50);

-- Add comment to the column
COMMENT ON COLUMN vaults.tag IS 'Vault category tag (e.g., Seed, Private, Advisors, Team)';

-- Create index for faster queries on tag
CREATE INDEX idx_vaults_tag ON vaults(tag) WHERE tag IS NOT NULL;
