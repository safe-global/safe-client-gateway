---
name: cgw-best-practices
description: Use before writing or changing any TypeScript in safe-client-gateway - the cross-cutting dos and don'ts that no domain guide owns and biome does not fully catch. Covers parse-don't-assert (no `as X` or `as unknown as X` on data whose shape the compiler cannot guarantee), no `any` and no @ts-ignore/@ts-expect-error in production code, no non-null assertions outside tests, `import type` for type-only imports (with the Symbol-DI-token exception), ILoggingService instead of console.*, no silently swallowed errors in a catch block, `private readonly` injected dependencies, explicit return types on exported methods, and named constants over inline magic values. Triggers on any TypeScript edit, plus "type error", "cast", "as unknown", "any", "catch block", "logging", "constant".
---

# CGW Best Practices

Read **[docs/agents/best-practices.md](../../../docs/agents/best-practices.md)** before any TypeScript change. This skill is a loader; the doc is the content.

These rules apply the same way in every module regardless of what it does. Several of them freeze a *current clean state* — zero instances in production `src/` today — as a baseline to hold, not a target to reach: zero `@ts-ignore`/`@ts-expect-error`, zero non-null assertions, zero `console.*` outside `main.ts`'s pre-DI bootstrap handler.

The one that matters most: **parse, don't assert.** An assertion never starts from `unknown`, `any`, or a raw payload — that is a parse, and `Schema.parse()` is what performs it. `as const` and a compiler-verifiable narrowing are unaffected. Test files have the one sanctioned exception, the partial-mock cast idiom (and even there, a *double* cast is redundant — see **cgw-remarks** R-001).

Each rule in the doc names its canonical example by repo path, and where the repo contains a live counter-example it says so explicitly with "do not imitate".
