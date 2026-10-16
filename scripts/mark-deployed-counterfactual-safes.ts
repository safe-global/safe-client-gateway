// SPDX-License-Identifier: FSL-1.1-MIT
/**
 * Marks counterfactual Safes that are already deployed (sets `deployed_at`).
 *
 * CGW marks a counterfactual Safe when it receives SAFE_CREATED. This script
 * marks the rows written before that, or whose event never arrived. The rows
 * and their user associations stay as a record; reads leave them out.
 *
 * A Safe counts as deployed when `GET /v1/chains/:chainId/safes/:address` of
 * the given CGW returns 200, and as undeployed on 404. Any other result keeps
 * the row and is reported, so a rerun picks it up.
 *
 *   yarn mark:deployed-counterfactual-safes --cgw-url=<url> [--dry-run]
 *
 *   --cgw-url  CGW of the same environment as the database.
 *   --dry-run  Report the deployed Safes; change nothing.
 */
import { DataSource } from 'typeorm';
import configuration from '#/config/entities/configuration';
import { postgresConfig } from '#/config/entities/postgres.config';

const BATCH_SIZE = 500;
// Kept low: the public CGW rate-limits bursts with 429.
const CHECK_CONCURRENCY = 5;

interface CounterfactualSafeRow {
  id: number;
  chain_id: string;
  address: string;
}

type DeploymentStatus = 'deployed' | 'undeployed' | 'unknown';

interface Totals {
  checked: number;
  deployed: number;
  unknown: number;
}

function parseCgwUrl(): string {
  const arg = process.argv.find((value) => value.startsWith('--cgw-url='));
  const cgwUrl = arg?.slice('--cgw-url='.length).replace(/\/+$/, '');
  if (!cgwUrl) {
    throw new Error(
      'Missing --cgw-url=<url>: pass the CGW of the same environment as the database',
    );
  }
  return cgwUrl;
}

async function getDeploymentStatus(
  cgwUrl: string,
  row: CounterfactualSafeRow,
): Promise<DeploymentStatus> {
  const label = `${row.chain_id}:${row.address}`;
  try {
    const response = await fetch(
      `${cgwUrl}/v1/chains/${row.chain_id}/safes/${row.address}`,
    );
    if (response.ok) {
      return 'deployed';
    }
    if (response.status === 404) {
      return 'undeployed';
    }
    console.warn(`  ${label}: unexpected status ${response.status}, kept`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  ${label}: request failed (${message}), kept`);
  }
  return 'unknown';
}

async function getStatuses(
  cgwUrl: string,
  rows: Array<CounterfactualSafeRow>,
): Promise<Array<DeploymentStatus>> {
  const statuses: Array<DeploymentStatus> = [];
  for (let i = 0; i < rows.length; i += CHECK_CONCURRENCY) {
    const chunk = rows.slice(i, i + CHECK_CONCURRENCY);
    statuses.push(
      ...(await Promise.all(
        chunk.map((row) => getDeploymentStatus(cgwUrl, row)),
      )),
    );
  }
  return statuses;
}

async function cleanup(
  dataSource: DataSource,
  cgwUrl: string,
  dryRun: boolean,
): Promise<Totals> {
  const totals: Totals = { checked: 0, deployed: 0, unknown: 0 };
  let lastId = 0;

  for (;;) {
    const rows = await dataSource.query<Array<CounterfactualSafeRow>>(
      'SELECT id, chain_id, address FROM counterfactual_safes WHERE id > $1 AND deployed_at IS NULL ORDER BY id LIMIT $2',
      [lastId, BATCH_SIZE],
    );
    if (rows.length === 0) {
      return totals;
    }
    lastId = rows[rows.length - 1].id;

    const statuses = await getStatuses(cgwUrl, rows);
    const deployed = rows.filter((_, i) => statuses[i] === 'deployed');
    for (const row of deployed) {
      console.info(`  deployed: ${row.chain_id}:${row.address}`);
    }
    if (!dryRun && deployed.length > 0) {
      await dataSource.query(
        'UPDATE counterfactual_safes SET deployed_at = NOW() WHERE id = ANY($1) AND deployed_at IS NULL',
        [deployed.map((row) => row.id)],
      );
    }

    totals.checked += rows.length;
    totals.deployed += deployed.length;
    totals.unknown += statuses.filter((status) => status === 'unknown').length;
  }
}

async function main(): Promise<void> {
  const cgwUrl = parseCgwUrl();
  const dryRun = process.argv.includes('--dry-run');
  const config = configuration();

  const dataSource = new DataSource({
    ...postgresConfig({
      ...config.db.connection.postgres,
      type: 'postgres',
    }),
  });
  await dataSource.initialize();

  try {
    console.info(dryRun ? 'Dry run...' : 'Marking deployed Safes...');
    const totals = await cleanup(dataSource, cgwUrl, dryRun);
    console.info(
      `Done. Checked: ${totals.checked}, ` +
        `${dryRun ? 'deployed' : 'marked'}: ${totals.deployed}, ` +
        `unknown (kept): ${totals.unknown}`,
    );
    if (totals.unknown > 0) {
      process.exitCode = 1;
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
