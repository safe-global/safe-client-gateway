DROP TABLE IF EXISTS account_data_types CASCADE;

CREATE TABLE account_data_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER update_account_data_types_updated_at
BEFORE UPDATE ON account_data_types
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

INSERT INTO account_data_types (name, description, is_active) VALUES
    ('CounterfactualSafes', 'Counterfactual Safes', true), 
    ('AddressBook', 'Address Book', false),
    ('Watchlist', 'Watchlist', false);
