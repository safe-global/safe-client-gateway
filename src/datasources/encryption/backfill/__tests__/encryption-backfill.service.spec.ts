// SPDX-License-Identifier: FSL-1.1-MIT
import { EncryptionBackfillService } from '@/datasources/encryption/backfill/encryption-backfill.service';
import type { IFieldEncryptionService } from '@/datasources/encryption/encryption.service.interface';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker/.';

const mockEncryptionService = {
  encrypt: jest.fn((v: string) => 'v1:enc-' + v),
  decrypt: jest.fn((v: string) => v.replace('v1:enc-', '')),
  hmac: jest.fn(() => 'a'.repeat(64)),
} as unknown as jest.MockedObjectDeep<IFieldEncryptionService>;

const mockRepository = {
  find: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
};

const mockPostgresDatabaseService = {
  getRepository: jest.fn().mockResolvedValue(mockRepository),
} as unknown as jest.MockedObjectDeep<PostgresDatabaseService>;

const mockLoggingService = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('EncryptionBackfillService', () => {
  let service: EncryptionBackfillService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    service = new EncryptionBackfillService(
      mockPostgresDatabaseService,
      mockEncryptionService,
      mockLoggingService,
    );
  });

  it('should process address rows with NULL hash column', async () => {
    const row = {
      id: 1,
      address: faker.finance.ethereumAddress(),
      addressHash: null,
    };

    // Wallet entity: first call returns rows, second empty
    mockRepository.find
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([])
      // SpaceSafe entity: no rows
      .mockResolvedValue([]);

    // Name entities: no rows
    mockQueryBuilder.getMany.mockResolvedValue([]);

    await service.backfillAll(10);

    expect(mockRepository.save).toHaveBeenCalledWith(row);
  });

  it('should process name rows without v1: prefix', async () => {
    const row = {
      id: 1,
      name: faker.person.fullName(),
    };

    // Address entities: no rows
    mockRepository.find.mockResolvedValue([]);

    // Name entities: first query returns rows, second empty
    mockQueryBuilder.getMany
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([])
      .mockResolvedValue([]);

    await service.backfillAll(10);

    expect(mockRepository.save).toHaveBeenCalledWith(row);
  });

  it('should do nothing when no rows need backfilling', async () => {
    mockRepository.find.mockResolvedValue([]);
    mockQueryBuilder.getMany.mockResolvedValue([]);

    await service.backfillAll();

    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('should log progress', async () => {
    mockRepository.find.mockResolvedValue([]);
    mockQueryBuilder.getMany.mockResolvedValue([]);

    await service.backfillAll();

    expect(mockLoggingService.info).toHaveBeenCalled();
  });
});
