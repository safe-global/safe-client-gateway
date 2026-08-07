<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

`src/datasources/` is cross-cutting infrastructure only — cache, db, network, jwt, kms, job-queue, storage,
circuit-breaker — plus legacy API clients not yet migrated. A new external API client belongs in its own
module's `datasources/`, not here: read
[docs/agents/module-structure.md](../../docs/agents/module-structure.md) before adding a file.

Working on anything in this tree: outbound calls go through `INetworkService`/`CacheFirstDataSource` (never
`fetch` directly), cache keys come only from `CacheRouter`, and TTLs come only from config — see
[docs/agents/caching-and-performance.md](../../docs/agents/caching-and-performance.md). Errors funnel through
`HttpErrorFactory`/`DataSourceError` ([docs/agents/api-dtos-and-validation.md](../../docs/agents/api-dtos-and-validation.md)).
Touching `jwt/` or `kms/`? Read [docs/agents/security.md](../../docs/agents/security.md).
