# Self-Signed Test Certificates

The files under `db_config/test` were generated for the purpose of testing the SSL connection locally.

When mounting `server.key` as a volume to be used be Postgres, make sure that the file has the correct permissions.
This can be achieved by setting the Read/Write permissions for the owner only: `chmod 600 server.key` ([reference](https://www.postgresql.org/docs/current/ssl-tcp.html#SSL-SETUP)).

**Do not use these files in a live environment**

Additionally, the self-signed certificate is a X509 certificate generated on March 1, 2024, with validity
of 365 days.

The CN used was `localhost`.
