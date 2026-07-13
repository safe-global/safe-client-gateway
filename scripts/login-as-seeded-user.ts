// SPDX-License-Identifier: FSL-1.1-MIT
/**
 * Dev script to make one real user a member of every space in the database,
 * instead of one fake account per space.
 *
 * `wallets.address` is unique, so a single wallet can never resolve to more
 * than one user — there's no way to "log in as" many fake users through the
 * same address. Consolidating therefore means the opposite: leave existing
 * users/spaces alone and grant --user-id membership of every space directly.
 * `members` also has a unique (user, space) constraint, and existing spaces
 * already have other members, so reassigning their existing membership
 * rows' user_id to a single user would collide after the first one per
 * space — this inserts one new row per space for --user-id instead
 * (`ON CONFLICT DO NOTHING`, safe to rerun).
 *
 * This only prepares the DB side (wallet link + memberships) — actually
 * signing in still goes through the real SIWE flow (GET /v1/auth/nonce ->
 * sign -> POST /v1/auth/verify) with the wallet matching the address below.
 *
 *   node --env-file=.env -r tsconfig-paths/register ./node_modules/.bin/ts-node \
 *     scripts/login-as-seeded-user.ts --user-id=<id>
 *
 *   --user-id=<id>  Existing user to link the wallet address to and grant
 *                   membership of every space (required).
 */

import { DataSource } from 'typeorm';
import configuration from '@/config/entities/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';

const BATCH_SIZE = 1000;

// Matches the on-disk integer values of the corresponding domain enums
// (MemberRole.MEMBER, MemberStatus.ACTIVE) — see scripts/seed-fake-users.ts.
const MEMBER_ROLE_MEMBER = 2;
const MEMBER_STATUS_ACTIVE = 1;

function parseArg(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg?.slice(`--${name}=`.length);
}

function parseUserIdArg(): number {
  const value = parseArg('user-id');
  if (!value) {
    throw new Error('--user-id=<id> is required');
  }
  const userId = Number(value);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('--user-id must be a positive integer');
  }
  return userId;
}

/**
 * Links `address` to `userId` via the "wallets" table so the SIWE flow
 * resolves to that exact user instead of creating a new one.
 */
async function linkWallet(
  dataSource: DataSource,
  userId: number,
  address: string,
): Promise<void> {
  const [user] = await dataSource.query<Array<{ id: number }>>(
    `SELECT id FROM "users" WHERE id = $1`,
    [userId],
  );
  if (!user) {
    throw new Error(`No user with id ${userId}`);
  }

  const [existing] = await dataSource.query<Array<{ user_id: number }>>(
    `SELECT user_id FROM "wallets" WHERE address = $1`,
    [address],
  );
  if (existing && existing.user_id !== userId) {
    throw new Error(
      `Address ${address} is already linked to user ${existing.user_id}, not ${userId}`,
    );
  }
  if (existing) {
    return;
  }

  await dataSource.query(
    `INSERT INTO "wallets" (user_id, address) VALUES ($1, $2)`,
    [userId, address],
  );
}

/** Grants `userId` membership of every space in the database. */
async function joinAllSpaces(
  dataSource: DataSource,
  userId: number,
): Promise<void> {
  const spaceRows = await dataSource.query<Array<{ id: number }>>(
    `SELECT id FROM "spaces"`,
  );
  const spaceIds = spaceRows.map((row) => row.id);

  for (let i = 0; i < spaceIds.length; i += BATCH_SIZE) {
    const batch = spaceIds.slice(i, i + BATCH_SIZE);
    const values: Array<string> = [];
    const params: Array<unknown> = [];
    for (const spaceId of batch) {
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
      `INSERT INTO "members" (user_id, space_id, name, role, status)
       VALUES ${values.join(', ')}
       ON CONFLICT (user_id, space_id) DO NOTHING`,
      params,
    );
  }

  console.info(`  members: joined ${spaceIds.length} spaces`);
}

async function main(): Promise<void> {
  const userId = parseUserIdArg();

  const config = configuration();
  const dataSource = new DataSource({
    ...postgresConfig({ ...config.db.connection.postgres, type: 'postgres' }),
  });
  await dataSource.initialize();
  try {
    await linkWallet(
      dataSource,
      userId,
      '0x572A48316eb950f0141fbb7652e528347Ef2E9Dd',
    );
    await joinAllSpaces(dataSource, userId);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
