---
name: cgw-risk-tiers
description: Use at the start of any implementation task and any review in safe-client-gateway to decide the change's risk tier (1 critical to 4 low) and therefore how much human review it needs and whether an agent may approve or merge it. Covers the tier table (Tier 1 needs two human maintainer approvals and an agreed plan, Tier 2 one human, Tier 3 agent may approve with a human merging, Tier 4 agent may approve and merge), the highest-tier-wins rule, the path-to-tier map, change kinds that escalate regardless of module (guards, signatures, JWT, KMS, secrets, migrations, new dependencies, signing-flow display data), the unmapped-path-defaults-to-Tier-2 rule, and stating the tier in the PR. Triggers on "how risky is this", "can I auto-approve", "can an agent merge this", "does this need a human", "who needs to review", "risk tier", "tier 1", "critical module", "approve this PR", "merge this", "LGTM", and on starting work in an unfamiliar module.
---

# CGW Risk Tiers

Read **[docs/agents/risk-tiers.md](../../../docs/agents/risk-tiers.md)** before you start implementing and before you give a review verdict. This skill only loads the guide; the guide holds the rules.

- **The most critical tier wins.** A PR's tier is the lowest-numbered tier of any file it touches. The guide's tier map assigns each path a tier. Some kinds of change raise the tier whatever module they're in, such as guards, signatures, secrets, migrations or new dependencies. A path the map doesn't cover is Tier 2.
- **An agent never approves or merges Tier 1 or Tier 2 work.** Tier 1 needs two human maintainers, Tier 2 needs one. At Tier 1, a human agrees the plan before anyone writes code.
- **State the tier and never understate it.** The first line of the PR's `## Summary` is `**Risk tier:** <n> — <reason>`. A reviewer works out the tier independently, and any PR that changes the tier map is itself Tier 1.

Load **cgw-review** alongside this skill when reviewing, because the tier goes at the top of its verdict.
