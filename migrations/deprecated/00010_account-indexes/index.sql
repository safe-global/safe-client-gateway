CREATE INDEX idx_accounts_group_id
  ON accounts (group_id);

CREATE INDEX idx_account_data_settings_account_id_account_data_type_id
  ON account_data_settings (account_id, account_data_type_id);

CREATE INDEX idx_counterfactual_safes_account_id
  ON counterfactual_safes(account_id);

CREATE INDEX idx_counterfactual_safes_account_id_chain_id_predicted_address
  ON counterfactual_safes(account_id, chain_id, predicted_address);

CREATE INDEX idx_targeted_safes_outreach_id_address
  ON targeted_safes (outreach_id, address);

CREATE INDEX idx_submissions_targeted_safe_id_signer_address
  ON submissions (targeted_safe_id, signer_address);
