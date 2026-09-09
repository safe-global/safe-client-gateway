#!/usr/bin/env bash
# SPDX-License-Identifier: FSL-1.1-MIT
# Compare what CGW and Zerion return for one Safe: balances, overview and
# portfolio from CGW; portfolio and positions straight from Zerion.
#
# Usage: scripts/zerion-debug.sh <chainId>:<safeAddress> [currency] [--trusted]
#
# The Zerion key is never stored here. Provide it through 1Password:
#   ZERION_API_KEY_REF=op://<vault>/<item>/<field>   (resolved with `op read`)
#   OP_ENVIRONMENT_ID=<id>                            (1Password Environment holding ZERION_API_KEY)
# or export ZERION_API_KEY yourself, e.g. via `op run --env-file=.env -- scripts/zerion-debug.sh ...`.
set -euo pipefail

target="${1:?usage: $0 <chainId>:<safeAddress> [currency] [--trusted]}"
chain_id="${target%%:*}"
address="${target##*:}"
currency="${2:-USD}"; [[ "$currency" == --* ]] && currency=USD
trusted=false; [[ " $* " == *" --trusted "* ]] && trusted=true

cgw="${CGW_BASE_URL:-https://safe-client.safe.global}"
config="${CONFIG_BASE_URL:-https://safe-config.safe.global}"
zerion="${ZERION_BASE_URI:-https://api.zerion.io}"

if [[ -z "${ZERION_API_KEY:-}" && -n "${ZERION_API_KEY_REF:-}" ]]; then
  ZERION_API_KEY="$(op read "$ZERION_API_KEY_REF")"
elif [[ -z "${ZERION_API_KEY:-}" && -n "${OP_ENVIRONMENT_ID:-}" ]]; then
  ZERION_API_KEY="$(op environment read "$OP_ENVIRONMENT_ID" | sed -n 's/^ZERION_API_KEY=//p' | tr -d '"')"
fi

get() { # get <label> <url> [curl args...] -> body on stdout ("null" on error), status on stderr
  local label="$1" url="$2"; shift 2
  local body status
  # CloudFront in front of CGW rejects requests without a browser-like user agent.
  body="$(curl -sSgL -w '\n%{http_code}' -A 'Mozilla/5.0 (Macintosh) Chrome/128.0 Safari/537.36' "$@" "$url")"
  status="${body##*$'\n'}"; body="${body%$'\n'*}"
  echo "  [$status] $label" >&2
  [[ "$status" == 2* ]] && echo "$body" || echo 'null'
}
show() { local f="$1"; shift; jq -r "$@" "if . == null then \"  (no data)\" else $f end"; }
section() { printf '\n== %s\n' "$1"; }

section "Chain config ($config)"
chain="$(get "chain $chain_id" "$config/api/v1/chains/$chain_id/")"
is_testnet="$(jq -r '.isTestnet // false' <<<"$chain")"
zerion_chain="$(jq -r '.balancesProvider.chainName // empty' <<<"$chain")"
show '"  chain: \(.chainName) | zerion chain name: \(.balancesProvider.chainName) | provider enabled: \(.balancesProvider.enabled) | PORTFOLIO_ENDPOINT: \(.features | index("PORTFOLIO_ENDPOINT") != null)"' <<<"$chain"

section "CGW ($cgw)"
balances="$(get "balances" "$cgw/v1/chains/$chain_id/safes/$address/balances/$currency?trusted=$trusted&exclude_spam=true")"
overview="$(get "overview (/v2/safes)" "$cgw/v2/safes?safes=$chain_id:$address&currency=$currency&trusted=$trusted")"
portfolio="$(get "portfolio (chainIds=$chain_id)" "$cgw/v1/portfolio/$address?fiatCode=$currency&chainIds=$chain_id&trusted=$trusted&excludeDust=false")"
show '"  balances:  total \(.fiatTotal) | tokens \(.items|length) | unpriced \([.items[] | select((.fiatConversion // "0") == "0")] | length)"' <<<"$balances"
show '.items | sort_by(-(.fiatBalance|tonumber))[:5][] | "    \(.tokenInfo.symbol)\t\(.fiatBalance) (\(.balance) @ \(.fiatConversion))"' <<<"$balances"
show '"  overview:  total \(.[0].fiatTotal)"' <<<"$overview"
show '"  portfolio: total \(.totalBalanceFiat) | tokens \(.totalTokenBalanceFiat) (\(.tokenBalances|length)) | positions \(.totalPositionsBalanceFiat) (\(.positionBalances|length))"' <<<"$portfolio"

section "Zerion ($zerion)"
if [[ -z "${ZERION_API_KEY:-}" ]]; then
  echo "  no key: set ZERION_API_KEY_REF, OP_ENVIRONMENT_ID or ZERION_API_KEY"; exit 0
fi
zargs=(-H "Authorization: Basic $ZERION_API_KEY"); [[ "$is_testnet" == true ]] && zargs+=(-H 'X-Env: testnet')
trash=; [[ "$trusted" == true ]] && trash='&filter[trash]=only_non_trash'
lc="$(tr '[:upper:]' '[:lower:]' <<<"$currency")"
zportfolio="$(get "wallet portfolio" "$zerion/v1/wallets/$address/portfolio?currency=$lc&filter[positions]=no_filter$trash" "${zargs[@]}")"
zpositions="$(get "wallet positions" "$zerion/v1/wallets/$address/positions?currency=$lc&sort=value&filter[positions]=no_filter$trash" "${zargs[@]}")"
show '"  portfolio: total \(.data.attributes.total.positions)"' <<<"$zportfolio"
show '.data.attributes.positions_distribution_by_chain | to_entries | sort_by(-.value)[] | "    \(.key)\t\(.value)"' <<<"$zportfolio"
show '"  positions: \(.data|length) total, by chain: " + ([.data[] | .relationships.chain.data.id] | group_by(.) | map("\(.[0]) (\(length))") | join(", "))' <<<"$zpositions"
echo "  positions on \"$zerion_chain\" (the chain name CGW uses for this chainId):"
show '[.data[] | select(.relationships.chain.data.id == $c)] | "    count \(length) | value \(map(.attributes.value // 0) | add // 0) | unpriced \(map(select(.attributes.price == null)) | length)"' --arg c "$zerion_chain" <<<"$zpositions"
show '[.data[] | select(.relationships.chain.data.id == $c)] | sort_by(-(.attributes.value // 0))[:5][] | "    \(.attributes.fungible_info.symbol)\t\(.attributes.value // "unpriced") (\(.attributes.quantity.float) @ \(.attributes.price // "-"))\(if .attributes.flags.is_trash then " trash" else "" end)"' --arg c "$zerion_chain" <<<"$zpositions"
