import configuration from '@/config/entities/__tests__/configuration';
import { AccountsDatasource } from '@/datasources/accounts/accounts.datasource';
import { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import shift from 'postgres-shift';
import { getAddress } from 'viem';

const config = configuration();

const isCIContext = process.env.CI?.toLowerCase() === 'true';

const sql = postgres({
  host: config.db.postgres.host,
  port: parseInt(config.db.postgres.port),
  db: config.db.postgres.database,
  user: config.db.postgres.username,
  password: config.db.postgres.password,
  // If running on a CI context (e.g.: GitHub Actions),
  // disable certificate pinning for the test execution
  ssl:
    isCIContext || !config.db.postgres.ssl.enabled
      ? false
      : {
          requestCert: config.db.postgres.ssl.requestCert,
          rejectUnauthorized: config.db.postgres.ssl.rejectUnauthorized,
          ca: fs.readFileSync(
            path.join(process.cwd(), 'db_config/test/server.crt'),
            'utf8',
          ),
        },
});

const mockLoggingService = {
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('AccountsDatasource tests', () => {
  let target: AccountsDatasource;

  // Run pending migrations before tests
  beforeAll(async () => {
    await shift({ sql });
  });

  beforeEach(() => {
    target = new AccountsDatasource(sql, mockLoggingService);
  });

  afterEach(async () => {
    await sql`TRUNCATE TABLE groups, accounts CASCADE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  describe('createAccount', () => {
    it('creates an account successfully', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      const result = await target.createAccount(address);

      expect(result).toStrictEqual({
        id: expect.any(Number),
        group_id: null,
        address,
      });
    });

    it('throws when an account with the same address already exists', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      await target.createAccount(address);

      await expect(target.createAccount(address)).rejects.toThrow(
        'Error creating account.',
      );
    });
  });

  describe('getAccount', () => {
    it('returns an account successfully', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      await target.createAccount(address);

      const result = await target.getAccount(address);

      expect(result).toStrictEqual({
        id: expect.any(Number),
        group_id: null,
        address,
      });
    });

    it('throws if no account is found', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await expect(target.getAccount(address)).rejects.toThrow(
        'Error getting account.',
      );
    });
  });
});
