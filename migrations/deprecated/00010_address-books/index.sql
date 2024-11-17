CREATE TABLE address_books (
    id SERIAL PRIMARY KEY,
    data BYTEA NOT NULL,
    key BYTEA NOT NULL,
    iv BYTEA NOT NULL,
    account_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    CONSTRAINT unique_account UNIQUE (account_id)
);

CREATE INDEX idx_address_books_account_id ON address_books(account_id);

CREATE OR REPLACE TRIGGER update_address_books_updated_at
BEFORE UPDATE ON address_books
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();