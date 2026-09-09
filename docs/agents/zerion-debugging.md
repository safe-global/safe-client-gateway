<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Debugging Zerion Data

Use this guide when a Safe shows different fiat totals in different places, when tokens are missing or unpriced, or when someone asks "is this a Zerion problem?". The answer is usually found by calling every source once and comparing, which `scripts/zerion-debug.sh` does for you.

## Three numbers, three sources

The wallet shows three totals for one Safe, and they come from three different data paths. A discrepancy between them is not a bug by itself; it tells you which path to inspect.

| Wallet view | CGW endpoint | Data source |
| --- | --- | --- |
| Tokens tab | `GET /v1/chains/{chainId}/safes/{address}/balances/{fiat}` | Transaction Service balances plus CGW's own price provider. Zerion is not involved. |
| Safe dropdown, overview | `GET /v2/safes?safes={chainId}:{address}` | Zerion wallet portfolio, one call per wallet, read at `positions_distribution_by_chain[<zerion chain name>]`. The chain name comes from the chain's `balancesProvider.chainName` in the config service. |
| Home, Positions | `GET /v1/portfolio/{address}?chainIds={chainId}` | Zerion wallet positions, filtered by chain id after Zerion's chain names are mapped to chain ids via Zerion's `/v1/chains`. |

Zerion is only consulted when the chain has the `PORTFOLIO_ENDPOINT` feature and `FF_ZERION_ENABLED` is on.

## Running the script

```bash
OP_ENVIRONMENT_ID=<your environment id> scripts/zerion-debug.sh <chainId>:<safeAddress> [currency] [--trusted]
```

It needs only bash, curl and jq. It calls the three CGW endpoints above, then Zerion's `/v1/wallets/{address}/portfolio` and `/v1/wallets/{address}/positions` with the same parameters CGW uses, and prints totals, token counts, unpriced tokens, the top tokens and Zerion's per-chain distribution.

The Zerion key is a secret. It must never be committed, pasted into a chat or written into a file, and an agent must never read or print it. Every developer has their own 1Password Environment mirroring `.env.sample.json`, including `ZERION_API_KEY`. Pass its id through `OP_ENVIRONMENT_ID` (1Password app: Developer, Environments, Manage environment, Copy environment ID), or point `ZERION_API_KEY_REF` at an `op://` secret reference. Never reuse another person's environment id. If no key is available, the script still prints the CGW side, which is often enough.

`CGW_BASE_URL`, `CONFIG_BASE_URL` and `ZERION_BASE_URI` override the production hosts, for example to compare staging.

## How to investigate

1. Run the script for the Safe from the report. Note which of the three CGW totals disagree.
2. If the balances total is low and many tokens are unpriced, the gap is in the Transaction Service or the price provider, not Zerion. Chains with exotic tokens (tokenised stocks, new L2s) often have no prices there.
3. If the overview differs from the portfolio, compare the chain name printed under "zerion chain name" with the keys Zerion returns in `positions_distribution_by_chain`. They must match. A wrong name in the config service makes the overview read another chain's slot.
4. If the portfolio differs from Zerion's own positions, look at trash and trusted filtering (`--trusted` mirrors the wallet's default), dust exclusion, and cache age (`ZERION_WALLET_PORTFOLIO_TTL_SECONDS`). `DELETE /v1/portfolio/{address}` clears CGW's Zerion caches for a wallet.
5. Only when CGW's inputs are correct and Zerion's own response is wrong or missing positions is it a Zerion issue. Then hand the raw Zerion output to the Zerion contact; nobody needs to read CGW code for that.

## Worked example

Report: on Robinhood Chain, Safe `0xCc0Eb03078195aA561183F106F9f76dd6b131Ec2` shows about $11 in the Safe dropdown but $3.3M on the home page, and the Tokens tab shows 41 tokens without a price. The team asked whether Zerion was misbehaving.

```bash
OP_ENVIRONMENT_ID=... scripts/zerion-debug.sh 4663:0xCc0Eb03078195aA561183F106F9f76dd6b131Ec2
```

Output, abridged:

```
chain: Robinhood Chain | zerion chain name: ethereum | PORTFOLIO_ENDPOINT: true
balances:  total 0 | tokens 70 | unpriced 69
overview:  total 11.28
portfolio: total 3314674 | tokens 1499167 (2) | positions 1815506 (1)
Zerion portfolio: total 3314685
  robinhood  3314674
  ethereum   11.28
positions on "ethereum": USDG, TURBO, PEPE
```

Reading it: Zerion returns the Safe's value under the chain name `robinhood`, but the config service maps chain 4663 to `ethereum`, so the overview reads the wallet's Ethereum mainnet slot, which holds three small tokens worth $11. The portfolio endpoint filters by chain id and is right. The unpriced tokens are a separate issue in the balances path. Neither is a Zerion defect; the fix is the chain's `balancesProvider.chainName` in the config service.
