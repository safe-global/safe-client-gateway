<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Configuration Examples

Concrete `Avoid` / `Prefer` shapes lifted from CGW PR review feedback. See
`../rules.json` for the durable rules.

## CONFIG-05 — `.env.sample` comments document encoding and format constraints

Source: PR #2849 (RL-20251215-003)

### Avoid

A bare `KEY=` placeholder in `.env.sample` when the variable has a
non-obvious encoding or format requirement:

```sh
# The API Key to be used. If none is set, balances cannot be retrieved
# using this provider.
# ZERION_API_KEY=
```

### Prefer

Document the encoding/format right next to the variable, so an operator
copying `.env.sample` to `.env` sees the constraint without consulting
the README:

```sh
# The API Key to be used. If none is set, balances cannot be retrieved
# using this provider. Must be the base64-encoded key — see
# https://developers.zerion.io/reference/authentication for details.
# ZERION_API_KEY=
```

### Why

`.env.sample` is the only file most operators read when wiring a fresh
deployment. README references get skimmed; a wrong-shape value (raw key
instead of base64, comma-separated instead of JSON, etc.) silently
disables the feature and the failure mode is "request returns 401" days
later. A one-line comment at the variable closes that gap.

## CHANGE-04 / CONFIG-05 — Env-var rename keeps the old name as a fallback for one release

Source: PR #2851 (RL-20260108-001)

### Avoid

Renaming an env var in the configuration loader while the PR description
claims backwards compatibility, and updating only `.env.sample` for the
new name:

```ts
// configuration.ts
features: {
  // was: FF_ZERION_BALANCES_CHAIN_IDS
  zerionBalancesEnabled: !!process.env.FF_ZERION_ENABLED,
},
```

Existing deployments still ship with `FF_ZERION_BALANCES_CHAIN_IDS=...`
in their environment and quietly turn the feature off on the next
release.

### Prefer

Read both names for one release; document the new name as authoritative
in `.env.sample`; remove the legacy fallback only in a follow-up PR:

```ts
// configuration.ts
features: {
  zerionBalancesEnabled:
    process.env.FF_ZERION_ENABLED !== undefined
      ? process.env.FF_ZERION_ENABLED.toLowerCase() === 'true'
      : // legacy, remove next release: a non-empty chain list enabled it
        (process.env.FF_ZERION_BALANCES_CHAIN_IDS ?? '').trim() !== '',
},
```

The new flag parses strictly per CONFIG-02 and wins whenever it is set; the
legacy variable keeps the meaning it had (a chain list, not a boolean) only
until the follow-up PR deletes it.

`.env.sample` lists the new var with the canonical default; the old
name is mentioned in a comment so operators know what to migrate from.

### Why

Env vars are part of the deployed contract. A rename without a fallback
is a silent feature flip on every consumer that did not redeploy with
the new name. Reading both for one release lets operations migrate
during a normal rollout window, after which the legacy branch can be
deleted with a clean PR that only touches the loader.

## CONFIG-02 — Conditionally required env vars extend the deployed-env required list

Source: PR #3135, #3142 (RL-20260608-001)

### Avoid

A standalone `superRefine` check for the new field, plus validation that
also fires in local development:

```ts
.superRefine((config, ctx) => {
  if (config.FF_FEATURE?.toLowerCase() === 'true' && !config.FEATURE_TOKEN_FILE) {
    ctx.addIssue({
      code: 'custom',
      message: 'is required when the feature is enabled',
      path: ['FEATURE_TOKEN_FILE'],
    });
  }
});
```

### Prefer

One deployed-env-only `superRefine` with a declarative required-fields
list; conditional requirements express themselves as `requiredWhen`:

```ts
.superRefine((config, ctx) => {
  const isDeployedEnv =
    !!config.CGW_ENV && ['production', 'staging'].includes(config.CGW_ENV);
  if (!isDeployedEnv) return;

  for (const {
    field,
    requiredWhen = true,
    message = 'is required in production and staging environments',
  } of [
    { field: 'PROVIDER_API_KEY' },
    {
      field: 'FEATURE_TOKEN_FILE',
      requiredWhen: config.FF_FEATURE?.toLowerCase() === 'true',
      message: 'is required in deployed environments when the feature is enabled',
    },
  ]) {
    if (requiredWhen && !(config as Record<string, unknown>)[field]) {
      ctx.addIssue({ code: 'custom', message, path: [field] });
    }
  }
});
```

Inside the feature module, read values the enabled feature needs with
`getOrThrow` so a deployed misconfiguration fails at startup, not at
first use.

### Why

The deployed-env guard exists so local development runs without
production secrets. A standalone check for a new field either re-fires
locally (defeating the guard) or duplicates the env gating. One
extendable list keeps every conditionally required var in one place,
with per-field conditions and messages.

## CONFIG-05 — Services that must match share one compose anchor

Source: PR #3453 (RL-20261009-001)

### Avoid

Two database services that each carry their own image and startup block,
so a version bump lands on one of them:

```yaml
services:
  db:
    image: postgres:18-alpine
    entrypoint: [/bin/sh, -c, "<install TLS files; exec entrypoint>", sh]
    command: [postgres, -c, ssl=on, -c, hba_file=/db_config/pg_hba.conf]
  db-test:
    image: postgres:14-alpine
    entrypoint: [/bin/sh, -c, "<install TLS files; exec entrypoint>", sh]
    command: [postgres, -c, ssl=on, -c, hba_file=/db_config/pg_hba.conf]
```

### Prefer

```yaml
x-postgres: &postgres
  image: postgres:18-alpine
  entrypoint: [/bin/sh, -c, "<install TLS files; exec entrypoint>", sh]
  command: [postgres, -c, ssl=on, -c, hba_file=/db_config/pg_hba.conf]

services:
  db:
    <<: *postgres
    volumes: [db-data:/var/lib/postgresql, ./db_config/test:/db_config:ro]
  db-test:
    <<: *postgres
    volumes: [./db_config/test:/db_config:ro]
```

### Why

Tests that run on another major than local dev prove less than they appear
to. One anchor makes the image and startup the same by construction. Keep
`volumes` per service: a merge key replaces lists rather than merging them.

## CHANGE-03 — Subpath imports give every tool a `types` target

Source: PR #3551 (RL-20261009-005)

### Avoid

A custom condition only some tools are told about. Biome does not know
`source`, falls through to `default` (absent in the CI lint job), and its
type-aware rules silently lose cross-module types:

```json
"imports": {
  "#/*": {
    "source": "./src/*.ts",
    "default": "./dist/src/*.js"
  }
}
```

### Prefer

```json
"imports": {
  "#/*": {
    "types": "./src/*.ts",
    "source": "./src/*.ts",
    "default": "./dist/src/*.js"
  }
}
```

### Why

`types` is a condition every TypeScript-aware tool understands, and Node
ignores it at runtime. Without it, rules such as `noFloatingPromises` stop
firing for new violations through `#/` while whole-tree lint counts stay the
same, so nothing shows the loss.
