DROP SCHEMA IF EXISTS emails CASCADE;
CREATE SCHEMA emails;

DROP TABLE IF EXISTS emails.signer_emails CASCADE;
CREATE table emails.signer_emails
(
    id                SERIAL PRIMARY KEY,
    chain_id          int                   NOT NULL,
    email_address     text                  NOT NULL,
    safe_address      character varying(42) NOT NULL,
    signer            character varying(42) NOT NULL,
    verified          boolean               NOT NULL DEFAULT false,
    verification_code text,
    sent_on           timestamp with time zone       DEFAULT now() NOT NULL,
    UNIQUE (chain_id, safe_address, signer)
);
