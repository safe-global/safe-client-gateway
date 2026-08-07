<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

`src/routes/` is a frozen tree. New feature code goes in `src/modules/<kebab>/` following the canonical
skeleton — read [docs/agents/module-structure.md](../../docs/agents/module-structure.md) before adding or moving
anything here.

Editing an existing route: a route service calls repositories (`domain/*.repository.ts`), never datasources
directly, and every `@Param`/`@Query`/`@Body` goes through `new ValidationPipe(ZodSchema)` —
see [docs/agents/api-dtos-and-validation.md](../../docs/agents/api-dtos-and-validation.md).
