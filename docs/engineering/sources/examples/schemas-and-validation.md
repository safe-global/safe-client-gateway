<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Schemas and Validation Examples

Concrete `Avoid` / `Prefer` shapes lifted from CGW PR review feedback. See
`../rules.json` for the durable rules.

## TYPE-04 — Reuse the canonical enum, do not hardcode literal arrays

Source: PR #2854 (RL-20251223-001)

### Avoid

Hardcoding the same status string in `@ApiProperty.enum`, `z.literal`, and
the DTO type:

```ts
@ApiProperty({
  enum: ['UNOFFICIAL_FALLBACK_HANDLER'],
})
status!: 'UNOFFICIAL_FALLBACK_HANDLER';

export const UnofficialResultSchema = BaseSchema.extend({
  type: z.literal('UNOFFICIAL_FALLBACK_HANDLER'),
});
```

### Prefer

Define the canonical enum once and reuse it across the schema, the DTO,
and the controller's Swagger metadata:

```ts
export enum ContractStatus {
  UnofficialFallbackHandler = 'UNOFFICIAL_FALLBACK_HANDLER',
  // ...
}

@ApiProperty({ enum: ContractStatus })
status!: ContractStatus;

export const UnofficialResultSchema = BaseSchema.extend({
  type: z.literal(ContractStatus.UnofficialFallbackHandler),
});
```

### Why

Three copies of `'UNOFFICIAL_FALLBACK_HANDLER'` drift independently the
moment the contract changes. The Zod literal, the OpenAPI schema, and the
runtime check should all read from the same source so a renamed value
shows up as a single fix, not three near-misses scattered across modules.

## MOD-04 — Do not export symbols that are not consumed externally

Source: PR #2850 (RL-20251216-002)

### Avoid

Exporting a constant or helper that no other module imports, on the
theory that it might be useful elsewhere later:

```ts
/**
 * Minimum Safe version that supports CompatibilityFallbackHandler.
 */
export const MIN_FALLBACK_HANDLER_VERSION = '>=1.3.0';
// ...nothing in the codebase imports MIN_FALLBACK_HANDLER_VERSION
```

### Prefer

Keep the symbol module-local; promote to an export when an actual
consumer or test references it:

```ts
const MIN_FALLBACK_HANDLER_VERSION = '>=1.3.0';
// Inline use within the module that owns the constant
```

### Why

Every `export` is a long-lived contract — typegen, IDE auto-import,
and downstream packages all latch on. Exporting "in case someone needs
it" multiplies the public surface without buying a real consumer; if
the next consumer needs a slightly different shape, removing the now-
imported symbol becomes a breaking change.

## MOD-04 — Do not export private intermediate schemas

Source: PR #2856 (RL-20251223-001)

### Avoid

Exporting every intermediate schema "for consistency" with sibling files:

```ts
// analysis-result.entity.ts — none of these are imported elsewhere
export const FailedAnalysisResultSchema = BaseSchema.extend({ /* ... */ });
export const ModerateAnalysisResultSchema = BaseSchema.extend({ /* ... */ });

export const AnalysisResultSchema = z.discriminatedUnion('type', [
  FailedAnalysisResultSchema,
  ModerateAnalysisResultSchema,
]);
```

### Prefer

Keep intermediate schemas module-local and export only the union or the
type the rest of the codebase consumes:

```ts
const FailedAnalysisResultSchema = BaseSchema.extend({ /* ... */ });
const ModerateAnalysisResultSchema = BaseSchema.extend({ /* ... */ });

export const AnalysisResultSchema = z.discriminatedUnion('type', [
  FailedAnalysisResultSchema,
  ModerateAnalysisResultSchema,
]);
```

### Why

Exported names become part of the module's public surface even when nothing
imports them yet, and tests start asserting on each piece instead of the
contract that ships. If a future consumer or test genuinely needs the
internal schema, promote it then — with the use site as the justification.

## TYPE-04 — Strict enum schemas for internal boolean query params

Source: PR #2812 (RL-20260123-002)

### Avoid

Accepting any string and post-filtering, then redundantly piping through
`z.boolean()`:

```ts
const BooleanStringDefaultFalseSchema = z
  .string()
  .optional()
  .transform((val) => val === 'true')
  .pipe(z.boolean());
```

### Prefer

Constrain the wire shape to the two valid strings up front; the
`.transform` then has only two cases to handle:

```ts
const BooleanStringDefaultFalseSchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((val) => val === 'true');

const BooleanStringDefaultTrueSchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((val) => val !== 'false');
```

### Why

The endpoint is internal, so there is no ecosystem pressure to be lenient
with `''`, `'TRUE'`, or anything else; tightening the wire contract makes
the parser fail fast on garbage instead of quietly coercing it to `false`,
and removes the `.pipe(z.boolean())` belt-and-braces step.

## TYPE-04 — Use unions for exact-one DTO shapes

Source: PR #3067 (RL-20260520-002)

### Avoid

Modeling an "address or email, but not both" payload as one loose object plus
cross-field refinement:

```ts
const InviteUserSchema = z
  .object({
    address: AddressSchema.optional(),
    email: z.email().max(255).optional(),
    role: z.enum(getStringEnumKeys(MemberRole)),
    name: NameSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.address && !value.email) {
      ctx.addIssue({ code: 'custom', path: ['address'] });
    }
  });
```

### Prefer

Make the two accepted wire shapes explicit:

```ts
const SharedInviteFields = {
  role: z.enum(getStringEnumKeys(MemberRole)),
  name: NameSchema,
};

const InviteUserSchema = z.union([
  z.object({ address: AddressSchema, ...SharedInviteFields }).strict(),
  z.object({ email: z.email().max(255), ...SharedInviteFields }).strict(),
]);
```

### Why

The union shows the API contract directly, gives better type narrowing to the
service/repository layer, and avoids misleading validation paths such as
pointing an email-only failure at `address`.
