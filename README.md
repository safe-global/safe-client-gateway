# Safe Client Gateway

[![Coverage Status](https://coveralls.io/repos/github/safe-global/safe-client-gateway/badge.svg?branch=main)](https://coveralls.io/github/safe-global/safe-client-gateway?branch=main)

## Motivation

The Safe Client Gateway serves as a bridge for the Safe{Wallet} clients (Android, iOS, Web).

It provides UI-oriented mappings and data structures for easier integration with several Safe{Core} services. In essence, it works as a bridge between the frontend and backend, ensuring smooth, efficient data exchange.

## Documentation

- [Client Gateway OpenAPI specification](https://safe-client.safe.global/api)
- [Deploying the service](https://github.com/safe-global/safe-infrastructure)

## Requirements

- Node.js v24.11.0 'Krypton' LTS ([Node.js Release Schedule](https://nodejs.org/en/about/previous-releases)) – https://nodejs.org/en/
- Docker Compose – https://docs.docker.com/compose/

## Installation

**Optional:** If you have NVM installed, you can run `nvm use` in the root folder of the project to use the recommended
Node version set for this project.

We use Yarn as the package manager for this project. Yarn is bundled with the project so to use it run:

```bash
corepack enable && yarn install
```

The project requires some ABIs that are generated after install. In order to manually generate them, run:

```bash
yarn generate-abis
```

## Setup your env

We recommend using what is available in the .env.sample file:

```bash
cp .env.sample .env
```

Then uncomment the variables you need and edit your `.env` file with your configuration values.

Please review the required API keys in the `.env` file and ensure you have created the necessary keys for the services you plan to use.

### Environment Variable Configuration

**Configuration Files:**

1. **`.env.sample.json`**: The source of truth for all environment variables
   - Contains variable names, descriptions, default values, and required status
   - Structured as an array of JSON objects
   - Version-controlled and validated

2. **`.env`**: Your local configuration (not in version control)
   - Copy variables from `.env.sample.json` as needed
   - Set required variables and override defaults

**For Developers Adding New Environment Variables:**

1. Add your variable to `.env.sample.json`:

   ```json
   {
     "name": "MY_NEW_VARIABLE",
     "description": "Description of what this variable does",
     "defaultValue": "default-value",
     "required": false
   }
   ```

2. Add to Zod schema in `configuration.schema.ts` (if validation needed):

   ```typescript
   MY_NEW_VARIABLE: z.string().optional(),
   ```

3. Use in `configuration.ts`:

   ```typescript
   myNewVariable: process.env.MY_NEW_VARIABLE || 'default-value',
   ```

4. When you commit, the pre-commit hook will validate that all variables are documented

**Manual Commands:**

```bash
# Generate .env file from required variables
yarn env:generate

# Generate .env file (force overwrite existing)
yarn env:generate:force

# Generate or update .env file (creates if missing, updates if exists)
yarn env:generate:update

# Validate that all env vars are documented (verbose)
yarn env:validate

# Validate silently (Only exit if there is an error)
yarn env:validate:silent
```

## Running the app

1. Start Redis instance. By default, it will start on port `6379` of `localhost`.

```shell
docker compose up -d redis
```

If you run the service locally against a local Safe{Wallet} instance,

- set `TX_SERVICE_API_KEY` to a valid key to avoid hitting the Transaction Service rate limit
- set `CGW_ENV=development`
- set `ALLOW_CORS=true`

To generate a key, go to:

- [Tx Service staging](https://developer.5afe.dev/api-keys)
- [Tx Service production](https://developer.safe.global/api-keys)

2. Start the Safe Client Gateway

```bash
# development
yarn run start

# watch mode
yarn run start:dev

# production mode
yarn run start:prod
```

## Test

The unit test suite contains tests that require a database connection.
This project provides a `db-test` container which also validates the support for SSL connections.
To start the container, make sure that the key for the self-signed certificate
has the right permissions.

```shell
# disallow any access to world or group
chmod 0600 db_config/test/server.key
```

With the right permissions set on the `server.key` file we can now start the `db-test` container:

```shell
# start the db-test container
docker compose up -d db-test

# unit tests
yarn run test

# e2e tests
docker-compose up -d redis rabbitmq && yarn run test:e2e

# test coverage
yarn run test:cov
```

## Linter and Style Guide

We use [ESLint](https://eslint.org/) as a linter and [Prettier](https://prettier.io/) as a code formatter.
You can run `yarn run lint` to execute ESLint and `yarn run format` to execute Prettier.

These checks can be automatically executed using Git hooks. If you wish to install the provided git hooks:

```shell
yarn install
yarn husky install
```

## Database Migrations

Database migrations are configured to execute automatically. To disable them, set the following environment variables:

```
RUN_MIGRATIONS=false
DB_MIGRATIONS_EXECUTE=false
```

For migrations to be generated automatically, the entity file must follow this structure and naming convention:

`src/**/entities/*.entity.db.ts`

The file should be located in the `src` folder, inside an `entities` directory. The filename should follow the format `{FILE_NAME}.entity.db.ts`, where `{FILE_NAME}` is replaced with your desired name.
