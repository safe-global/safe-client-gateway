import { dbFactory } from '@/__tests__/db.factory';
import { AccountsDatasource } from '@/datasources/accounts/accounts.datasource';
import { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { getAddress } from 'viem';

const sql = dbFactory();
const migrator = new PostgresDatabaseMigrator(sql);

const mockLoggingService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('AccountsDatasource tests', () => {
  let target: AccountsDatasource;

  // Run pending migrations before tests
  beforeAll(async () => {
    await migrator.migrate();
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
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
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
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('throws if no account is found', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await expect(target.getAccount(address)).rejects.toThrow(
        'Error getting account.',
      );
    });
  });

  describe('deleteAccount', () => {
    it('deletes an account successfully', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      await target.createAccount(address);

      await expect(target.deleteAccount(address)).resolves.not.toThrow();

      expect(mockLoggingService.debug).not.toHaveBeenCalled();
    });

    it('does not throws if no account is found', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await expect(target.deleteAccount(address)).resolves.not.toThrow();

      expect(mockLoggingService.debug).toHaveBeenCalledTimes(1);
    });
  });
});
