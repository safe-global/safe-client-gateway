---
description: Add an environment variable end to end — configuration.ts, RootConfigurationSchema, .env.sample.json, test config — and validate it.
argument-hint: <ENV_VAR_NAME> <what it configures>
---

Add an environment variable to `safe-client-gateway`: $ARGUMENTS

Load the `cgw-config` skill → `docs/agents/configuration-and-flags.md` first, and `cgw-security` → `docs/agents/security.md` if the variable is a secret.

Non-negotiable #7: **every env var is declared in `configuration.ts` AND `RootConfigurationSchema`; secrets never get fallback defaults.** All five steps below land in one change — a variable in `configuration.ts` but not the schema fails at the first request that needs it instead of at boot.

1. **`src/config/entities/configuration.ts`** — add the read under the topic section it belongs to. Name the section for the *topic*, not the upstream service (`billing`, not `billingServiceApi`); if a section for the topic already exists, extend it rather than adding a second. TTL keys are `<thing>TtlSeconds`. Parse numbers explicitly. A non-secret may carry a sensible default; a secret must not.
2. **`src/config/entities/schemas/configuration.schema.ts`** — add it to `RootConfigurationSchema` with the tightest type that is true (a URL as a URL, a positive integer as one, an enum as an enum). This is the check that turns a missing or malformed value into a boot failure.
3. **`.env.sample.json`** — add the entry so `yarn env:validate` and the CI `env-validation` job see it. For a secret, use a placeholder that is obviously not a real value.
4. **`src/config/entities/__tests__/configuration.ts`** — mirror the key so specs reading it do not diverge from production config.
5. **Read it back** through `this.configurationService.getOrThrow<T>('topic.key')` in the consuming class's constructor, cached on a `private readonly` field. Never `process.env` outside `src/config/`.

**If it is a feature flag:** prefix the variable `FF_`, read it through `features.*`, and state its removal condition in the PR body — a flag with no removal condition becomes permanent config. Name it for everything it gates, not for the narrowest thing.

Then run `yarn env:validate` and report its output, followed by `yarn format`, `yarn lint --fix`, and the specs for anything you touched.

Mention the new variable in the PR body's `## Risk` section: what happens when it is unset.
