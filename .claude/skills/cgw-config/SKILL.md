---
name: cgw-config
description: Use when adding or changing an environment variable, a feature flag, or any configuration read in safe-client-gateway. Covers the rule that every env var is declared in configuration.ts AND validated in RootConfigurationSchema with no fallback default for a secret, reading config via IConfigurationService.getOrThrow cached in the constructor (never process.env outside src/config/), mirroring keys in __tests__/configuration.ts, the .env.sample.json plus yarn env:validate loop, the FF_ prefix and features.* read path for flags with a removal condition, TTL key naming, and the rule against special-casing chain IDs in code. Triggers on "env var", "environment variable", "feature flag", "FF_", "config key", "configuration.ts", "TTL", "hard-coded timeout".
---

# CGW Configuration and Flags

Read **[docs/agents/configuration-and-flags.md](../../../docs/agents/configuration-and-flags.md)** before adding a variable or a flag. This skill is a loader; the doc is the content.

Non-negotiable #7 from [AGENTS.md](../../../AGENTS.md): **every env var is declared in `configuration.ts` AND `RootConfigurationSchema`; secrets never get fallback defaults.** A variable missing from the schema fails at the first request that needs it instead of at boot, and a secret with a default silently runs the service in an insecure mode rather than refusing to start.

The full loop when adding one: `configuration.ts` → `RootConfigurationSchema` → `.env.sample.json` → mirror in `__tests__/configuration.ts` → `yarn env:validate`.

Read it back through `this.configurationService.getOrThrow<T>('path.to.key')`, called in the constructor and cached on a field. `process.env` is read only inside `src/config/`.

Three recurring remarks: a hard-coded timeout, batch size, or TTL belongs in config (**cgw-remarks** R-018, with TTL keys named `*TtlSeconds`); a gate that isn't a declared `FF_` flag becomes permanent config (R-019); and a variable read but not validated is R-025.

Working inside `src/config/` auto-loads the pointer stub at `src/config/AGENTS.md`, which routes here.
