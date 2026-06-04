<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Repository & Pagination Examples

Concrete `Avoid` / `Prefer` shapes lifted from CGW PR review feedback. See
`../rules.json` for the durable rules.

## REUSE-01 — Derive version lists from safe-deployments

Source: PR #2850 (RL-20251216-001)

### Avoid

Hardcoding the set of supported Safe contract or fallback-handler
versions in a constant inside the consuming module:

```ts
// Manually enumerated, gets stale with every release
export const FALLBACK_HANDLER_VERSIONS = ['1.3.0', '1.4.1'] as const;

export function getFallbackHandlerVersions(): Array<string> {
  return [...FALLBACK_HANDLER_VERSIONS].reverse();
}
```

### Prefer

Derive the list from `@safe-global/safe-deployments` so the source of
truth — the deployments package — drives the runtime set, and a
contract release does not need a coordinated edit in every consumer:

```ts
import { getCompatibilityFallbackHandlerDeployments } from '@safe-global/safe-deployments';

export function getFallbackHandlerVersions(): Array<string> {
  return getCompatibilityFallbackHandlerDeployments({ released: true })
    .map((d) => d.version)
    .sort(semverDescending);
}
```

### Why

Hardcoded version arrays drift behind the deployments package the
moment a new contract version ships. Deriving from the package keeps
the supported set self-updating — the only thing left to verify is
that the consuming code handles the new version's behavior, not that
someone remembered to add the string.

## CONFIG-03 / REUSE-01 — Knobs follow the existing config-driven precedent

Source: PR #2883 (RL-20260506-003)

### Avoid

Hardcoding a pagination/threshold knob in a new repository when sibling
repositories already read the same kind of value from configuration:

```ts
export class EntityRepository {
  async getAllByOwnerV2(...) {
    // Safety limit to prevent infinite loops
    // todo move to config, similar to chains and contracts repositories?
    const maxSequentialPages = 10;
    // ...
  }
}
```

### Prefer

Inject `IConfigurationService`, follow the precedent (`ChainsRepository`,
`ContractsRepository`) and add the knob to `configuration.ts` plus the
test fixture in the same PR:

```ts
export class EntityRepository {
  private readonly maxSequentialPages: number;

  constructor(
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    /* ... */
  ) {
    this.maxSequentialPages = configurationService.getOrThrow<number>(
      'entity.entitiesByOwner.maxSequentialPages',
    );
  }
}
```

### Why

Hardcoded knobs drift from the rest of the repo as ops needs change —
ChainsRepository can be tuned without a deploy, the new one cannot. The
TODO comment in the diff captures the author's awareness; promote it to a
real config entry now, while the surrounding code is fresh.

## PERF-01 — Extract the field you actually need per page

Source: PR #2883 (RL-20260506-006)

### Avoid

Accumulating full upstream objects across paginated requests when only one
field flows downstream:

```ts
const allEntities: Array<EntityV2> = [];
do {
  const { next, results } = EntityPageV2Schema.parse(page);
  allEntities.push(...results); // each EntityV2 carries fields we never use
  // fetch next page using next
} while (next);

return allEntities.map((e) => e.address);
```

### Prefer

Extract the field per page so memory grows only with the values that are
actually returned:

```ts
const allAddresses: Array<Address> = [];
do {
  const { next, results } = EntityPageV2Schema.parse(page);
  for (const entity of results) {
    allAddresses.push(entity.address);
  }
  // fetch next page using next
} while (next);

return allAddresses;
```

### Why

A 10-page response with 200 entities/page holds 2 000 full objects in
memory just to project to addresses at the end. Pushing the projected
field per page keeps the working set proportional to the answer, not to
the upstream's response shape, and shows up immediately when a user has a
deep pagination depth.
