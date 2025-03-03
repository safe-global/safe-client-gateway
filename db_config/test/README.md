# Self-Signed Test Certificates

The files under `db_config/test` were generated for the purpose of testing the SSL connection locally.

When mounting `server.key` as a volume to be used be Postgres, make sure that the file has the correct permissions.
This can be achieved by setting the Read/Write permissions for the owner only: `chmod 600 server.key` ([reference](https://www.postgresql.org/docs/current/ssl-tcp.html#SSL-SETUP)).

**Do not use these files in a live environment**

Additionally, the self-signed certificate is a X509 certificate generated on March 3, 2025, with validity
of 365 days.

The CN used was `localhost`.

## Generating a New Self-Signed Certificate

To generate a new certificate when the existing one expires, follow these steps:

1. Generate a 2048-bit RSA private key:

```shell
openssl genrsa -out server.key 2048
```

2. Set the required permissions for PostgreSQL:

```shell
chmod 600 server.key
```

3. Create a Certificate Signing Request (CSR):

```shell
openssl req -new -key server.key -out server.csr -subj "/CN=localhost"
```

4. Generate a self-signed certificate (valid for 365 days):

```shell
openssl x509 -req -in server.csr -signkey server.key -out server.crt -days 365
```

5. Verify the newly generated certificate:

```shell
openssl x509 -in server.crt -noout -text
```

Once the new certificate is in place, it can be used to re-establish the SSL connection for local testing.
