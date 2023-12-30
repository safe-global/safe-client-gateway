DROP SCHEMA IF EXISTS emails CASCADE;
CREATE SCHEMA emails;

DROP TABLE IF EXISTS emails.account_emails CASCADE;
CREATE table emails.account_emails
(
    id                             SERIAL PRIMARY KEY,
    chain_id                       int                   NOT NULL,
    email_address                  text                  NOT NULL,
    safe_address                   character varying(42) NOT NULL,
    account                        character varying(42) NOT NULL,
    verified                       boolean               NOT NULL DEFAULT false,
    verification_code              text,
    verification_code_generated_on timestamp with time zone,
    verification_sent_on           timestamp with time zone,
    UNIQUE (chain_id, safe_address, account)
);
