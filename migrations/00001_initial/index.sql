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
    unsubscription_token           uuid                  NOT NULL,
    UNIQUE (chain_id, safe_address, account)
);

DROP TABLE IF EXISTS emails.subscriptions CASCADE;
CREATE TABLE emails.subscriptions
(
    id   SERIAL PRIMARY KEY,
    key  TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
);

-- Add the default subscription type: account_recovery
INSERT INTO emails.subscriptions (key, name)
VALUES ('account_recovery', 'Account Recovery');

DROP TABLE IF EXISTS emails.account_subscriptions CASCADE;
CREATE TABLE emails.account_subscriptions
(
    account_id      INT,
    subscription_id INT,
    FOREIGN KEY (account_id) REFERENCES emails.account_emails (id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES emails.subscriptions (id) ON DELETE CASCADE,
    UNIQUE (account_id, subscription_id)
)
