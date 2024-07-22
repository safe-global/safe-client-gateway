DROP TABLE IF EXISTS counterfactual_safes CASCADE;

CREATE TABLE counterfactual_safes (
    id SERIAL PRIMARY KEY,
    chain_id VARCHAR(32) NOT NULL,
    creator VARCHAR(42) NOT NULL,
    fallback_handler VARCHAR(42) NOT NULL,
    owners VARCHAR(42)[] NOT NULL,
    predicted_address VARCHAR(42) NOT NULL,
    salt_nonce VARCHAR(255) NOT NULL,
    singleton_address VARCHAR(42) NOT NULL,
    threshold INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    account_id INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    CONSTRAINT unique_chain_address UNIQUE (account_id, chain_id, predicted_address)
);

CREATE OR REPLACE TRIGGER update_counterfactual_safes_updated_at
BEFORE UPDATE ON counterfactual_safes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
