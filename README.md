# Safe Client Gateway

[![Coverage Status](https://coveralls.io/repos/github/safe-global/safe-client-gateway-nest/badge.svg?branch=main)](https://coveralls.io/github/safe-global/safe-client-gateway-nest?branch=main)

## Motivation

The Safe Client Gateway serves as a bridge for the Safe{Wallet} clients (Android, iOS, Web).

It provides UI-oriented mappings and data structures for easier integration with several Safe{Core} services. In essence, it works as a bridge between the frontend and backend, ensuring smooth, efficient data exchange.

## Documentation

- [Client Gateway OpenAPI specification](https://safe-client.safe.global/index.html)
- [Deploying the service](https://github.com/safe-global/safe-infrastructure)

## Requirements

- Node 20.8.1 – https://nodejs.org/en/
- Docker Compose – https://docs.docker.com/compose/

## Installation

```bash
corepack enable && yarn install
```

## Running the app

1. Start Redis instance. By default, it will start on port `6379` of `localhost`.

```shell
docker compose up -d redis
```

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

```bash
# unit tests
yarn run test

# e2e tests
yarn run test:e2e

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
