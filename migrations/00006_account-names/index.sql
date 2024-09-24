ALTER TABLE public.accounts
ADD COLUMN name bytea,
ADD COLUMN name_hash varchar(64),
ADD CONSTRAINT name_hash_unique UNIQUE (name_hash);
