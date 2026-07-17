# Verify Workflow

Use verify mode to measure whether the current ruleset would have pre-empted
the review findings on real PRs, BEFORE compounding those PRs into the rules.
Verify runs on a window of closed PRs the ruleset has not learned from yet;
the standard weekly cycle is: verify the new window → score → compound it.

Read `references/convention-docs-schema.md` first for the eval file shapes
(`working/eval/`, `eval-ledger.json`, `eval-result.schema.json`).

## Contamination Rule (non-negotiable)

Never evaluate a PR against a ruleset that already contains learnings distilled
from that PR. The ruleset under test is the committed `rules.json` whose
review-learning ledger coverage ends BEFORE the PR closed. Record that commit
sha as `rulesetRef` in every eval file. In the weekly cycle this is simply the
current HEAD before the compound run.

## Window And PR Selection

1. Window = the next uncompounded closed-at window (same bounds the compound
   run will use).
2. Fetch the PR list with `scripts/fetch-pr-comments.sh` (same corpus the
   compound run reads).
3. Evaluate every PR that has at least one human review comment, plus a sample
   of zero-comment PRs (they test the false-positive rate; a run that only
   sees commented PRs never measures over-flagging).
4. Skip PRs authored primarily by bots and PRs with no source diff (pure
   dependency bumps).

## Reviewed-State Reconstruction

The self-review must see what the first reviewer saw — not the merged result,
which already contains the review fixes.

1. Primary anchor: the head commit at the moment the PR became ready for
   review — `ready_for_review` timeline event time for draft PRs
   (`gh api repos/<repo>/issues/<N>/timeline`), else the PR `created_at`;
   take the last commit from `gh api repos/<repo>/pulls/<N>/commits` pushed
   at or before that time.
2. Fallback (head unavailable/unfetchable): the `commit_id` of the earliest
   review of ANY round, including bot reviews. Do NOT use the first human
   review — when bots review first, their fixes land before the human ever
   looks and the eval silently loses those findings.
3. `git fetch origin <sha>`, then diff against `git merge-base <sha>
   origin/main`. Record the anchor kind in the eval file.

## Blind Self-Review

Run the self-review as a subagent that receives ONLY:

- the frozen convention docs at `rulesetRef` (`rules.json`,
  `conventions/*.md`), extracted via `git show <rulesetRef>:<path>`, and
- the reviewed-state diff and PR title.

It must NOT see review comments, the merged diff, or later commits. The agent
reports structured findings (`ruleId`, `file`, `line`, one-sentence finding)
plus rule-gap candidates (observations no rule covers). Zero findings is a
valid result; instruct the agent not to pad. If the orchestrating session has
already read the PR's review comments, a subagent is mandatory — an inline
review by a contaminated evaluator must be marked `"blind": false` and is a
mechanics check, not a scoreable data point.

## Ground Truth

From the fetched corpus, list every human comment on the PR plus bot comments
with confirmed human acceptance (same acceptance rules as
`workflows/compound.md`). Classify each as `mappable` (expressible as a
convention rule) or not (`question`, `product-decision`, `process`, `praise`).
Recall is computed over mappable comments only. Only count comments made at or
after the reviewed state — feedback already incorporated before the anchor
commit belongs to an earlier state and is out of scope.

## Matching And Merge Self-Validation

For every finding and every mappable comment, assign exactly one verdict:

- `hit` — finding semantically matches a ground-truth comment (same defect,
  not necessarily the same wording or rule id).
- For non-matching findings, check the merged result (`git diff <reviewedSha>
  <mergeSha>` scoped to the flagged file):
  - `validated_candidate` — the flagged issue was fixed by merge time even
    though no reviewer commented on it. The reviewer baseline is incomplete;
    these are the system catching what humans missed, and count in the
    system's favor.
  - `unconfirmed_candidate` — the issue survives in the merged code. Not a
    strike against the rule by itself; triage during the compound step
    (a human look, or a targeted check) decides whether it was a real catch
    or an over-broad check.
- `disputed` — the ruleset and a reviewer comment actively disagree (rule
  endorses what the reviewer criticized, or vice versa). Surface these to the
  user; they are ruleset-vs-reviewer conflicts to settle, not misses.
- Mappable comments with no matching finding are `misses` — each one is a
  compound-step input: tighten the rule/check whose scope should have caught
  it, citing the comment ids.

Use a judge subagent for the matching when the finding/comment counts are
non-trivial; its verdicts go into the eval file verbatim.

## Resumability And Storage

- One JSON file per PR: `docs/engineering/sources/working/eval/pr-<N>.json`,
  validating against `working/eval/eval-result.schema.json`.
- A run resumes by skipping PRs whose file already exists with the same
  `rulesetRef`; re-running with a different `rulesetRef` overwrites.
- After all PRs in the window are scored, append a window summary to
  `working/eval/eval-ledger.json` (counts + recall) and update `lastRun`.
- Commit the eval files. Fetched comment corpora remain temporary and are
  deleted as in compound mode; eval files store comment ids, never bodies.

## Scoring

Per window: `recall = hits / mappable`, plus counts of validated candidates,
unconfirmed candidates, disputed, and per-rule tallies (which rules hit,
which never fire). There is no precision-vs-reviewer metric: reviewers are
not an oracle, so extra findings are candidates to triage, not noise to
penalize.

## Feeding The Compound Run

The verify output is the compound run's worklist:

- every `miss` → tighten/add a rule or learning, citing the miss's comment ids;
- every `validated_candidate` → confirms the rule; optionally add the PR as
  evidence to the rule's learning;
- every `disputed` → raise with the user or add to
  `working/open-question-options.md`;
- recurring `unconfirmed_candidate`s from the same rule → rewrite the check
  text to be more precise.

Then run the compound workflow for the same window as usual. Rule edits made
after a verify run should be re-checked against the already-scored windows
(same eval files, new `rulesetRef`) to confirm hits are not lost — that is
the regression suite for the manual.
