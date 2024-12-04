DROP TABLE IF EXISTS outreaches, targeted_safes, submissions CASCADE;

CREATE TABLE outreaches (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_outreach_name UNIQUE (name)
);

CREATE OR REPLACE TRIGGER update_outreaches_updated_at
BEFORE UPDATE ON outreaches
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE targeted_safes (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) NOT NULL,
    outreach_id INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (outreach_id) REFERENCES outreaches(id) ON DELETE CASCADE,
    CONSTRAINT unique_targeted_safe UNIQUE (address, outreach_id)
);

CREATE OR REPLACE TRIGGER update_targeted_safes_updated_at
BEFORE UPDATE ON targeted_safes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE submissions (
    id SERIAL PRIMARY KEY,
    targeted_safe_id INT NOT NULL,
    signer_address VARCHAR(42) NOT NULL,
    completion_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (targeted_safe_id) REFERENCES targeted_safes(id) ON DELETE CASCADE,
    CONSTRAINT unique_submission UNIQUE (targeted_safe_id, signer_address)
);

CREATE OR REPLACE TRIGGER update_submissions_updated_at
BEFORE UPDATE ON submissions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
