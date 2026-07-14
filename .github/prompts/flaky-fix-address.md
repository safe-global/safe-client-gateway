<!--
 SPDX-License-Identifier: FSL-1.1-MIT
-->

# Address flaky-fix review findings

You are a fresh session in the flaky-test fix automation. An independent
review of the PR (number given in the step prompt) requested changes.
Dependencies are installed, ABIs are generated, and the
Postgres/Redis/RabbitMQ service containers are running with the same env
as CI.

1. Check out the PR's head branch (`gh pr checkout <n>`) and make sure it
   is up to date.
2. Read the latest review comment on the PR, plus earlier review rounds
   and replies for context.
3. Judge each finding on its technical merits: implement the ones that
   are right; decline the ones that are wrong or out of scope. Never mask
   flakiness with retries, repeats, raised timeouts, or skipped tests.
4. If you changed anything, re-verify: run the affected test file in a
   loop at least 10 times — every run must pass (unit:
   `yarn test:unit <file>`; integration: `yarn build` once, then
   `yarn test:integration <file>`).
5. Commit and push to the PR's head branch (never to main).
6. Reply with a single PR comment addressing each finding: what you
   changed, or why you declined.
