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
