DROP TABLE IF EXISTS account_data_settings CASCADE;

CREATE TABLE account_data_settings (
    account_id INTEGER NOT NULL,
    account_data_type_id INTEGER NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (account_id, account_data_type_id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER update_account_data_settings_updated_at
BEFORE UPDATE ON account_data_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();