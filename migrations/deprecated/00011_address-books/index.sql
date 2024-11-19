DROP TABLE IF EXISTS address_books CASCADE;

CREATE TABLE address_books (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL,
    chain_id VARCHAR(32) NOT NULL,
    data BYTEA NOT NULL,
    key BYTEA NOT NULL,
    iv BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    CONSTRAINT unique_account_id_chain_id UNIQUE (account_id, chain_id)
);

CREATE INDEX idx_address_books_account_id_chain_id
    ON address_books(account_id, chain_id);

CREATE OR REPLACE TRIGGER update_address_books_updated_at
BEFORE UPDATE ON address_books
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

UPDATE account_data_types SET is_active = true WHERE name = 'AddressBook';
