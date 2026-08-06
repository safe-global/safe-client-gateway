---
name: cgw-architecture
description: The system map for safe-client-gateway - load it whenever a change spans more than one layer, or when you need to know what happens between the request arriving and the upstream call. Covers the request lifecycle (Fastify to guards to ValidationPipe to controller to route service to repository to datasource to CacheFirstDataSource to upstream), the layer boundaries and which layer may call which, where Schema.parse() happens, the cache-invalidation flow, the error-funnel map, and the SIWE/JWT/OIDC auth flows. Triggers on "where does this go", "which layer", "how does a request flow", "what calls what", "should this be in the service or the repository", "why is this endpoint slow" (before profiling - the layer map tells you what it touches), "trace this request", "add a feature that needs a new endpoint and a new upstream call", plus any first look at an unfamiliar part of this codebase.
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
