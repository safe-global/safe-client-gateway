import { TestDbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { TargetedMessagingDatasource } from '@/datasources/targeted-messaging/targeted-messaging.datasource';
import { createOutreachDtoBuilder } from '@/domain/targeted-messaging/entities/tests/create-outreach.dto.builder';
import { createTargetedSafesDtoBuilder } from '@/domain/targeted-messaging/entities/tests/create-target-safes.dto.builder';
import { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker/.';
import { NotFoundException } from '@nestjs/common';
import postgres from 'postgres';
import { getAddress } from 'viem';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('TargetedMessagingDataSource tests', () => {
  let sql: postgres.Sql;
  let migrator: PostgresDatabaseMigrator;
  let target: TargetedMessagingDatasource;
  const testDbFactory = new TestDbFactory();

  beforeAll(async () => {
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    migrator = new PostgresDatabaseMigrator(sql);
    await migrator.migrate();

    target = new TargetedMessagingDatasource(sql, mockLoggingService);
  });

  afterEach(async () => {
    await sql`TRUNCATE TABLE submissions, targeted_safes, outreaches CASCADE`;
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testDbFactory.destroyTestDatabase(sql);
  });

  describe('createOutreach', () => {
    it('creates an outreach successfully', async () => {
      const dto = createOutreachDtoBuilder().build();

      const result = await target.createOutreach(dto);

      expect(result).toStrictEqual({
        id: expect.any(Number),
        name: dto.name,
        startDate: dto.startDate,
        endDate: dto.endDate,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('throws if the creation fails', async () => {
      const dto = createOutreachDtoBuilder().build();

      await target.createOutreach(dto);

      // An outreach with the same name already exists
      await expect(target.createOutreach(dto)).rejects.toThrow(
        'Error creating outreach',
      );
    });
  });

  describe('createTargetedSafes', () => {
    it('adds targetedSafes successfully', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();

      const result = await target.createTargetedSafes(createTargetedSafesDto);

      expect(result).toStrictEqual([
        {
          id: expect.any(Number),
          outreachId: createTargetedSafesDto.outreachId,
          address: createTargetedSafesDto.addresses[0],
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
        {
          id: expect.any(Number),
          outreachId: createTargetedSafesDto.outreachId,
          address: createTargetedSafesDto.addresses[1],
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
      ]);
    });

    it('fails if the outreach does not exist', async () => {
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();

      await expect(
        target.createTargetedSafes(createTargetedSafesDto),
      ).rejects.toThrow('Error adding targeted Safes');
    });

    it('fails if the Safe was already targeted in the same outreach', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const address = getAddress(faker.finance.ethereumAddress());
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [address, address])
        .build();

      await expect(
        target.createTargetedSafes(createTargetedSafesDto),
      ).rejects.toThrow('Error adding targeted Safes');
    });

    it('fails if the Safe was already targeted in the same outreach (2)', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const address = getAddress(faker.finance.ethereumAddress());
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [address])
        .build();

      // Create the targeted safe
      const created = await target.createTargetedSafes(createTargetedSafesDto);
      expect(created).toHaveLength(1);

      // Fails when trying to create the same targeted safe
      await expect(
        target.createTargetedSafes(createTargetedSafesDto),
      ).rejects.toThrow('Error adding targeted Safes');
    });
  });

  describe('getTargetedSafe', () => {
    it('gets a targetedSafe successfully', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );

      const result = await target.getTargetedSafe({
        outreachId: outreach.id,
        safeAddress: createTargetedSafesDto.addresses[0],
      });

      expect(result).toStrictEqual({
        id: targetedSafes[0].id,
        address: targetedSafes[0].address,
        outreachId: outreach.id,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('throws if the targetedSafe does not exist', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      await target.createTargetedSafes(createTargetedSafesDto);

      await expect(
        target.getTargetedSafe({
          outreachId: outreach.id,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSubmission', () => {
    it('creates a submission successfully', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );

      const result = await target.createSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });

      expect(result).toStrictEqual({
        id: expect.any(Number),
        outreachId: outreach.id,
        targetedSafeId: targetedSafes[0].id,
        signerAddress,
        completionDate: expect.any(Date),
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('gets a submission successfully', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );
      const signerAddress = getAddress(faker.finance.ethereumAddress());

      await target.createSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });

      const result = await target.getSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });

      expect(result).toStrictEqual({
        id: expect.any(Number),
        outreachId: outreach.id,
        targetedSafeId: targetedSafes[0].id,
        signerAddress,
        completionDate: expect.any(Date),
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('throws if the submission does not exist', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );

      await expect(
        target.getSubmission({
          targetedSafe: targetedSafes[0],
          signerAddress: getAddress(faker.finance.ethereumAddress()),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws if trying to create a submission for the same targetedSafe and signerAddress', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );
      const signerAddress = getAddress(faker.finance.ethereumAddress());

      // First submission
      await target.createSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });

      // Second submission - same targetedSafe and signerAddress
      await expect(
        target.createSubmission({
          targetedSafe: targetedSafes[0],
          signerAddress,
        }),
      ).rejects.toThrow('Error creating submission');
    });
  });
});
