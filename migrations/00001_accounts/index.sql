DROP TABLE IF EXISTS groups,
accounts CASCADE;

CREATE TABLE
    groups (id SERIAL PRIMARY KEY);

CREATE TABLE
    accounts (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES groups (id),
        address CHARACTER VARYING(42) NOT NULL,
        UNIQUE (address)
    );