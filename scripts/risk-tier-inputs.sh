#!/usr/bin/env bash
# SPDX-License-Identifier: FSL-1.1-MIT
# Read API data only. The caller checks out this script from the protected base.
set -euo pipefail
cd "${RUNNER_TEMP:?}"
pull="repos/${GITHUB_REPOSITORY:?}/pulls/${PR:?}"

snapshot() {
  gh api "$pull" | jq -ce --arg head "$HEAD_SHA" --arg base "$BASE_SHA" '
    select(.state == "open" and .head.sha == $head and .base.sha == $base and (.user.id | type) == "number")
    | {body, user: {id: .user.id}, commits, changed_files, head: .head.sha, base: .base.sha}'
}
snapshot > pr.json

# The files endpoint stops at 3,000. Never classify a partial or duplicate list.
gh api --paginate "$pull/files?per_page=100" |
  jq -sce --slurpfile pr pr.json '
    add | if length > 0 and length == $pr[0].changed_files and (unique_by(.filename) | length == $pr[0].changed_files)
      then .[] else error("Incomplete PR file list. Maintainer review required.") end
    | {filename, previous_filename, additions, deletions}' > changed-files.ndjson

# GraphQL exposes primary authors and Co-authored-by identities on each commit.
# The REST commits endpoint stops at 250 and only identifies the primary author.
gh api graphql --paginate -F owner="${GITHUB_REPOSITORY%/*}" \
  -F repo="${GITHUB_REPOSITORY#*/}" -F number="$PR" -f query='
  query($owner: String!, $repo: String!, $number: Int!, $endCursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        headRefOid baseRefOid
        commits(first: 50, after: $endCursor) {
          pageInfo { hasNextPage endCursor }
          totalCount nodes { commit { oid authors(first: 100) {
            totalCount nodes { user { databaseId } }
          } } }
        }
      }
    }
  }' | jq -ser --slurpfile pr pr.json '
    map(.data.repository.pullRequest) as $pages
    | [$pages[].commits.nodes[].commit] as $commits
    | if ($pages | length > 0 and all(.headRefOid == $pr[0].head and .baseRefOid == $pr[0].base and .commits.totalCount == $pr[0].commits))
      and ($commits | length == $pr[0].commits and length > 0)
      and ($commits | unique_by(.oid) | length == $pr[0].commits)
      and all($commits[].authors; .totalCount > 0 and .totalCount == (.nodes | length) and all(.nodes[]; (.user.databaseId | type) == "number"))
      then $commits[].authors.nodes[].user.databaseId
      else error("Incomplete commit or co-author identities. Maintainer review required.") end' > commit-authors.txt

gh api --paginate "$pull/reviews?per_page=100" |
  jq -c --arg head "$HEAD_SHA" '.[] | select(.user != null) |
    {id: (.user.id | tostring), login: .user.login, type: .user.type,
     state: (if .state == "APPROVED" and .commit_id != $head then "DISMISSED" else .state end)}' > reviews.ndjson

# Organization-controlled custom property. Each value is an immutable numeric user ID.
gh api "repos/$GITHUB_REPOSITORY/properties/values" |
  jq -r '.[] | select(.property_name == "risk-tier-maintainers") | .value[]' > maintainers.txt
snapshot > pr-after.json
if ! cmp -s pr.json pr-after.json; then
  echo "::error::PR metadata changed while collecting evidence. Rerun for the current revision."
  exit 1
fi
