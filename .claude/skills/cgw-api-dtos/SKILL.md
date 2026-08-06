---
name: cgw-api-dtos
description: Use when adding or changing an endpoint, a controller handler, a request or response DTO, a Zod schema, Swagger/OpenAPI annotations, or pagination in safe-client-gateway. Covers the ValidationPipe(ZodSchema)-on-every-input rule, the DTO pairing (Zod schema plus an @ApiProperty class declared implements z.infer), the Raw<T> boundary and where Schema.parse() must happen, the four-representations checklist for any persisted-shape field change, pagination via buildPageSchema plus a concrete Page<T> subclass, URI versioning, and the one-error-funnel-per-layer rule. Triggers on "new endpoint", "add a field", "DTO", "Zod schema", "validation", "Swagger", "OpenAPI", "@ApiProperty", "pagination", "response shape".
---

# CGW API, DTOs, and Validation

Read **[docs/agents/api-dtos-and-validation.md](../../../docs/agents/api-dtos-and-validation.md)** before touching the API surface. This skill is a loader; the doc is the content.

Three non-negotiables from [AGENTS.md](../../../AGENTS.md) live here:

- **Every `@Param` / `@Query` / `@Body` goes through `new ValidationPipe(ZodSchema)`.** No bare parameter access, ever.
- **Datasources return `Raw<T>`; the owning repository must `Schema.parse()`** before returning it as a domain entity. The phantom type exists so the compiler notices when you skip it.
- **One error funnel per layer**: `HttpErrorFactory` / `DataSourceError` in datasources, domain errors plus filters in `domain/`, `HttpExceptionNoLog` for expected rejections.

The checklist that gets skipped most: changing a **persisted** field's shape means updating **four** representations — the domain Zod schema, the `.entity.db.ts` plus a migration, the route DTO classes, and the test builder. Miss one and the failure surfaces somewhere unrelated.

Two recurring remarks live on the DTO half — see **cgw-remarks** R-010 (optional and nullable are different declarations; optional fields take `@ApiPropertyOptional`) and R-011 (reuse the shared schema instead of writing a new one).
