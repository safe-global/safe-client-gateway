<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Safe Client Gateway

[![Coverage Status](https://coveralls.io/repos/github/safe-global/safe-client-gateway/badge.svg?branch=main)](https://coveralls.io/github/safe-global/safe-client-gateway?branch=main)

## Motivation

The Safe Client Gateway serves as a bridge for the Safe{Wallet} clients (Android, iOS, Web).

It provides UI-oriented mappings and data structures for easier integration with several Safe{Core} services. In essence, it works as a bridge between the frontend and backend, ensuring smooth, efficient data exchange.

## Documentation

- [Client Gateway OpenAPI specification](https://safe-client.safe.global/api)
- [Deploying the service](https://github.com/safe-global/safe-infrastructure)
- [Billing webhook authentication & token generation](./src/modules/billing/README.md)

## Requirements

- Bun v1.4.2 (the version pinned in `package.json`'s `packageManager`) – https://bun.com/
- Docker Compose – https://docs.docker.com/compose/

## Installation

Bun is the runtime, package manager and test runner for this project. Install it from https://bun.com/docs/installation, then run:

```bash
bun install
```

Installs follow the supply-chain settings in `bunfig.toml` and `package.json`: no version published less than 7 days ago is resolved (`minimumReleaseAge`), dependencies' lifecycle scripts never run (`trustedDependencies: []`), and CI installs with `--frozen-lockfile`. Check the resolved packages against known advisories with:

```bash
bun audit
```

The project requires some ABIs that are generated after install. In order to manually generate them, run:

```bash
bun run generate-abis
```

### Development with Dev Containers

If you have Docker and the [VS Code/Cursor Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) installed, you can develop the project without installing Bun or any of the backing services on your host:

1. Open the repository in VS Code/Cursor.
2. Run **Dev Containers: Reopen in Container** from the command palette.

On first build the container will install dependencies with `bun install --frozen-lockfile` (which also generates the required ABIs via the `postinstall` hook).

The following services start automatically alongside the dev container: Postgres (`db`), Postgres test DB (`db-test`), Redis (`redis`), and RabbitMQ (`rabbitmq`). The `web`, `nginx`, and `pgadmin` services from `docker-compose.yml` are NOT auto-started; if you need them, run them from the host with:

```bash
docker compose up <service>
```

Note: both `db` and `db-test` run with SSL enabled, so before you reopen in container — or any time you run `docker compose up db`/`db-test` from the host — make sure the self-signed key has owner-only permissions (see [Running the services](#running-the-services)).

VS Code/Cursor installs the Biome, Bun, Claude Code, and ChatGPT extensions automatically inside the container.

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
bun run env:generate

# Generate .env file (force overwrite existing)
bun run env:generate:force

# Generate or update .env file (creates if missing, updates if exists)
bun run env:generate:update

# Validate that all env vars are documented (verbose)
bun run env:validate

# Validate silently (Only exit if there is an error)
bun run env:validate:silent
```

## Running the services

Both the `db` and `db-test` Postgres containers run with SSL enabled using a self-signed certificate stored in `db_config/test/`. Postgres refuses to start if the private key is group- or world-readable, so before launching either container (whether from the host or via the dev container) restrict the key to the owner:

```shell
# disallow any access to world or group
chmod 0600 db_config/test/server.key
```

This only needs to be done once per checkout (and again after a fresh `git clone`).

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
bun run start

# watch mode
bun run start:dev

# production mode (with OpenTelemetry tracing, as in the container image)
bun run start:prod
```

Bun runs the TypeScript sources directly: there is no build step. Bun loads `.env` from the project root automatically.

## Test

The unit test suite contains tests that require a database connection.
This project provides a `db-test` container which also validates the support for SSL connections.

Make sure the self-signed certificate key has the right permissions (see [Running the services](#running-the-services)), then start the `db-test` container:

```shell
# start the db-test container
docker compose up -d db-test

# unit tests
bun run test

# integration tests
docker compose up -d redis rabbitmq && bun run test:integration

# e2e tests
docker compose up -d redis rabbitmq && bun run test:e2e

# test coverage
bun run test:cov
```

Tests run on Bun's built-in test runner (`bun:test`); see [docs/agents/testing.md](docs/agents/testing.md).

## Linter and Style Guide

We use [Biome](https://biomejs.dev/) as linter and formatter (Bun has no built-in linter or formatter).
You can run `bun run lint` and `bun run format`, and type-check with `bun run typecheck`.

These checks can be automatically executed using Git hooks. If you wish to install the provided git hooks:

```shell
bun install
bunx husky
```

## Observability

Traces are produced with [OpenTelemetry](https://opentelemetry.io/) (`src/tracing/`) and exported over OTLP/HTTP. Datadog's `dd-trace` does not support the Bun runtime, so the Datadog Agent ingests them through its OTLP receiver instead.

- The container image starts the app with `bun --preload ./src/tracing/tracing.ts src/main.ts` (also `bun run start:prod`), which patches the HTTP server, PostgreSQL (`pg`), Redis (`redis`, `ioredis`) and RabbitMQ (`amqplib`) clients before the app loads them. Outbound HTTP calls made through the network service get client spans and propagate W3C `traceparent` headers.
- Spans go to `http://$DD_AGENT_HOST:4318/v1/traces` unless `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` or `OTEL_EXPORTER_OTLP_ENDPOINT` is set. The Agent's OTLP/HTTP receiver must be enabled, e.g. `DD_OTLP_CONFIG_RECEIVER_PROTOCOLS_HTTP_ENDPOINT=0.0.0.0:4318` (see [Datadog's OTLP ingestion docs](https://docs.datadoghq.com/opentelemetry/setup/otlp_ingest_in_the_agent/)).
- `DD_SERVICE`, `DD_ENV` and `DD_VERSION` become the `service.name`, `deployment.environment.name` and `service.version` resource attributes; the standard `OTEL_SERVICE_NAME`/`OTEL_RESOURCE_ATTRIBUTES` take precedence. Sampling follows `OTEL_TRACES_SAMPLER`/`OTEL_TRACES_SAMPLER_ARG` (default: every trace). Set `OTEL_SDK_DISABLED=true` to turn tracing off.
- Logs are JSON on stdout, collected by the Agent as before. Each line written inside a trace carries `dd.trace_id` and `dd.span_id`, which Datadog uses to link it to its trace.

## Database Migrations

Database migrations are configured to execute automatically. To disable them, set the following environment variables:

```
RUN_MIGRATIONS=false
DB_MIGRATIONS_EXECUTE=false
```

For migrations to be generated automatically, the entity file must follow this structure and naming convention:

`src/**/entities/*.entity.db.ts`

The file should be located in the `src` folder, inside an `entities` directory. The filename should follow the format `{FILE_NAME}.entity.db.ts`, where `{FILE_NAME}` is replaced with your desired name.

## Licensing

This repository contains code developed under two different ownership and licensing regimes, split by a defined cut-over date.

- **Up to and including February 16, 2026**
  Code is © Safe Ecosystem Foundation and licensed under the **MIT License**.
  The final SEF-owned MIT snapshot is tagged as: **`sef-mit-final`**
- **From February 17, 2026 onward**
  New development is © Safe Labs GmbH and licensed under the
  **Functional Source License, Version 1.1 (MIT Future License)**.

Users who require a purely MIT-licensed codebase should base their work on the `sef-mit-final` tag. The historical MIT-licensed code remains MIT and is not retroactively relicensed.

For full details, see `LICENSE.md` and `NOTICE.md`.

