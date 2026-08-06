---
name: cgw-architecture
description: Use when starting any non-trivial change in safe-client-gateway, or when deciding where a piece of code belongs - covers the request lifecycle (Fastify to guards to ValidationPipe to controller to route service to repository to datasource to CacheFirstDataSource to upstream), the layer boundaries, where Schema.parse() happens, the cache-invalidation flow, the error-funnel map, and the auth flows. Triggers on "where does this go", "how does a request flow", "what calls what", "new route", "new datasource", "which layer".
---

# CGW Architecture

Read **[docs/agents/ARCHITECTURE.md](../../../docs/agents/ARCHITECTURE.md)** — the system reference for this repo. This skill is a loader; the doc is the content.

Read it before writing code for anything non-trivial. It answers:

- What this service is (a caching BFF for Safe{Wallet} clients) and what it trusts.
- The full request lifecycle and which layer is allowed to talk to which.
- Where validation happens — `ValidationPipe` on the way in, `Schema.parse()` on a datasource's `Raw<T>` on the way out.
- Cache architecture, including webhook/AMQP invalidation via `EventCacheHelper` and the stale-write race guard.
- The error funnel per layer, and the SIWE / JWT-cookie / OIDC auth flows.

The layering in one line: `Controller → Route Service → Repository → Datasource → CacheFirstDataSource`.

Then follow the routing table in [AGENTS.md](../../../AGENTS.md) to the guides for what you are actually changing — this doc explains the system, the other guides carry the rules.
