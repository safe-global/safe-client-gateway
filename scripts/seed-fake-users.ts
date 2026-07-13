// SPDX-License-Identifier: FSL-1.1-MIT
/**
 * One-off script to seed fake users, spaces, and memberships for load-testing
 * scripts/backfill-user-email-encryption.ts.
 *
 * Generates plaintext, unique fake emails on a clearly-fake domain and leaves
 * `email_index` NULL — this is exactly the pre-backfill state the migration
 * script expects, so a freshly seeded batch can be fed straight into it.
 *
 *   node --env-file=.env -r tsconfig-paths/register ./node_modules/.bin/ts-node \
 *     scripts/seed-fake-users.ts [--users=10000] [--spaces=<n>] [--seed=<n>]
 *
 *   --users=<n>   Number of users to create (default 10000).
 *   --spaces=<n>  Number of spaces to create (default ceil(users / 20)).
 *   --seed=<n>    Faker seed for reproducible data (default: random, printed).
 *   --cleanup     Delete everything created by the last run (reads the
 *                 manifest below) instead of seeding.
 *
 * A manifest of generated user/space IDs is written to
 * scripts/.seed-manifest.json so --cleanup can remove exactly those rows by
 * ID later, even after the backfill script has overwritten `email` with
 * ciphertext (which would otherwise break any cleanup based on email content).
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';
import configuration from '@/config/entities/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';

const DEFAULT_USERS = 1000;
const USERS_PER_SPACE = 30;
const BATCH_SIZE = 100;
const EMAIL_DOMAIN = 'bench.seed.local';
const MANIFEST_PATH = join(__dirname, '.seed-manifest.json');

// Matches the on-disk integer values of the corresponding domain enums
// (UserStatus.ACTIVE, SpaceStatus.ACTIVE, MemberRole.MEMBER,
// MemberStatus.ACTIVE) — see src/modules/{users,spaces}/domain/entities/*.
const USER_STATUS_ACTIVE = 1;
const SPACE_STATUS_ACTIVE = 1;
const MEMBER_ROLE_MEMBER = 2;
const MEMBER_STATUS_ACTIVE = 1;

interface Manifest {
  userIds: Array<number>;
  spaceIds: Array<number>;
}

function parseIntArg(name: string): number | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) {
    return undefined;
  }
  const value = Number(arg.slice(`--${name}=`.length));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return value;
}

/** Runs `fn` over `items` in chunks of `size`, sequentially. */
async function forEachBatch<T>(
  items: Array<T>,
  size: number,
  fn: (batch: Array<T>) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size));
  }
}

async function seedUsers(
  dataSource: DataSource,
  count: number,
): Promise<Array<number>> {
  const ids: Array<number> = [];
  const indices = Array.from({ length: count }, (_, i) => i);

  await forEachBatch(indices, BATCH_SIZE, async (batch) => {
    const values: Array<string> = [];
    const params: Array<unknown> = [];
    for (const i of batch) {
      // const email = '';
      const email =
        `user${i}.${faker.internet
          .username()
          .toLowerCase()
          .replace(/[^a-z0-9._-]/g, '')}` + `@${EMAIL_DOMAIN}`;
      params.push(USER_STATUS_ACTIVE, email);
      values.push(`($${params.length - 1}, $${params.length})`);
    }
    const rows = await dataSource.query<Array<{ id: number }>>(
      `INSERT INTO "users" (status, email) VALUES ${values.join(', ')} RETURNING id`,
      params,
    );
    ids.push(...rows.map((row) => row.id));
    process.stdout.write(`  users: ${ids.length}/${count} created\r`);
  });

  console.info(`  users: ${ids.length}/${count} created`);
  return ids;
}

async function seedSpaces(
  dataSource: DataSource,
  count: number,
): Promise<Array<number>> {
  const ids: Array<number> = [];
  const indices = Array.from({ length: count }, (_, i) => i);

  await forEachBatch(indices, BATCH_SIZE, async (batch) => {
    const values: Array<string> = [];
    const params: Array<unknown> = [];
    for (const i of batch) {
      params.push(`Seed Space ${i}`, SPACE_STATUS_ACTIVE);
      values.push(`($${params.length - 1}, $${params.length})`);
    }
    const rows = await dataSource.query<Array<{ id: number }>>(
      `INSERT INTO "spaces" (name, status) VALUES ${values.join(', ')} RETURNING id`,
      params,
    );
    ids.push(...rows.map((row) => row.id));
  });

  console.info(`  spaces: ${ids.length}/${count} created`);
  return ids;
}

/** Assigns each user to exactly one random seeded space via a membership row. */
async function seedMembers(
  dataSource: DataSource,
  userIds: Array<number>,
  spaceIds: Array<number>,
): Promise<void> {
  let created = 0;

  await forEachBatch(userIds, BATCH_SIZE, async (batch) => {
    const values: Array<string> = [];
    const params: Array<unknown> = [];
    for (const userId of batch) {
      const spaceId = faker.helpers.arrayElement(spaceIds);
      params.push(
        userId,
        spaceId,
        `Seed Member ${userId}`,
        MEMBER_ROLE_MEMBER,
        MEMBER_STATUS_ACTIVE,
      );
      values.push(
        `($${params.length - 4}, $${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length})`,
      );
    }
    await dataSource.query(
      `INSERT INTO "members" (user_id, space_id, name, role, status) VALUES ${values.join(', ')}`,
      params,
    );
    created += batch.length;
    process.stdout.write(`  members: ${created}/${userIds.length} created\r`);
  });

  console.info(`  members: ${created}/${userIds.length} created`);
}

async function cleanup(dataSource: DataSource): Promise<void> {
  if (!existsSync(MANIFEST_PATH)) {
    console.info(
      'No manifest found at scripts/.seed-manifest.json — nothing to clean up.',
    );
    return;
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;

  await dataSource.transaction(async (manager) => {
    await manager.query(
      `DELETE FROM "members" WHERE user_id = ANY($1) OR space_id = ANY($2)`,
      [manifest.userIds, manifest.spaceIds],
    );
    await manager.query(`DELETE FROM "users" WHERE id = ANY($1)`, [
      manifest.userIds,
    ]);
    await manager.query(`DELETE FROM "spaces" WHERE id = ANY($1)`, [
      manifest.spaceIds,
    ]);
  });

  unlinkSync(MANIFEST_PATH);
  console.info(
    `Deleted ${manifest.userIds.length} users and ${manifest.spaceIds.length} spaces (and their memberships).`,
  );
}

async function main(): Promise<void> {
  const config = configuration();
  const dataSource = new DataSource({
    ...postgresConfig({ ...config.db.connection.postgres, type: 'postgres' }),
  });
  await dataSource.initialize();

  try {
    if (process.argv.includes('--cleanup')) {
      await cleanup(dataSource);
      return;
    }

    const seed = parseIntArg('seed') ?? Math.floor(Math.random() * 1e9);
    faker.seed(seed);
    console.info(`Faker seed: ${seed}`);

    const userCount = parseIntArg('users') ?? DEFAULT_USERS;
    const spaceCount =
      parseIntArg('spaces') ??
      Math.max(1, Math.ceil(userCount / USERS_PER_SPACE));

    console.info(`Seeding ${userCount} users and ${spaceCount} spaces...`);
    const spaceIds = await seedSpaces(dataSource, spaceCount);
    const userIds = await seedUsers(dataSource, userCount);
    await seedMembers(dataSource, userIds, spaceIds);

    const manifest: Manifest = { userIds, spaceIds };
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest));
    console.info(
      `Done. Manifest written to scripts/.seed-manifest.json — run with --cleanup to remove this data.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
