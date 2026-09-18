<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Style Examples

Concrete `Avoid` / `Prefer` shapes lifted from CGW PR review feedback. See
`../rules.json` for the durable rules.

## STYLE-01 / TYPE-06 — Destructuring with the same name shadows the outer binding

Source: PR #2883 (RL-20260506-005)

### Avoid

Loop control depending on a `let` that the destructure inside the loop
silently shadows:

```ts
let next: string | null = null;
do {
  const page = await api.getPage({ offset });
  const { next, results } = pageSchema.parse(page); // shadows outer `next`
  allItems.push(...results);
  if (next) {
    offset = PaginationData.fromLimitAndOffset(new URL(next)).offset;
  }
} while (next); // outer `next` never reassigned, stays null forever
```

### Prefer

Either rename in the destructure and reassign the outer variable, or
project explicitly so the shadowing cannot happen:

```ts
let next: string | null = null;
do {
  const page = await api.getPage({ offset });
  const { next: nextUrl, results } = pageSchema.parse(page);
  next = nextUrl;
  allItems.push(...results);
  if (next) {
    offset = PaginationData.fromLimitAndOffset(new URL(next)).offset;
  }
} while (next);
```

### Why

The shadowed-`next` bug is invisible in review unless you read both the
declaration and the destructure together — the inner block looks correct
in isolation, and the loop "just runs once" in tests with single-page
fixtures. Renaming in the destructure makes the assignment to the outer
binding explicit and impossible to forget.

## STYLE-01 / TYPE-06 — Name the accumulator instead of commenting the fold

Source: PR #2824, #2831 (RL-20251208-002, RL-20251209-001)

### Avoid

A narrating comment kept in place to explain a fold whose accumulator was
never typed:

```ts
// Group issues by severity: map the type to a severity, create the bucket
// if it does not exist yet, then push the issue into it.
const grouped = items
  .filter(({ type }) => FLAGGED_TYPES.includes(type))
  .reduce((acc, { type, description, address }) => {
    const key = SEVERITY_MAP[type]
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push({ description, address })
    return acc
  }, {} as Partial<Record<Severity, Array<Issue>>>) as GroupedIssues
```

### Prefer

```ts
const grouped = items
  .filter(({ type }) => FLAGGED_TYPES.includes(type))
  .reduce<GroupedIssues>((groups, { type, description, address }) => {
    const severity = SEVERITY_MAP[type]

    groups[severity] ??= []
    groups[severity].push({ description, address })

    return groups
  }, {})
```

### Why

The comment existed to carry what the code did not say: an untyped
accumulator, a conditional-key push, and a trailing cast to paper over both.
Declaring the accumulator through the `reduce<T>` generic makes the seed and
the result type-check on their own, and `??=` states the create-if-absent step
in one line. Both casts and the comment disappear together. An offer to
"add a comment explaining it step by step" is a restructure request — and a
comment that merely restates the line beneath it is deleted outright.
