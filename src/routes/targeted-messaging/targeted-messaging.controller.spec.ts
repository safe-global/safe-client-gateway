import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { ITargetedMessagingDatasource } from '@/domain/interfaces/targeted-messaging.datasource.interface';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { submissionBuilder } from '@/domain/targeted-messaging/entities/tests/submission.builder';
import { targetedSafeBuilder } from '@/domain/targeted-messaging/entities/tests/targeted-safe.builder';
import { SubmissionNotFoundError } from '@/domain/targeted-messaging/errors/submission-not-found.error';
import { TargetedSafeNotFoundError } from '@/domain/targeted-messaging/errors/targeted-safe-not-found.error';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker/.';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { getAddress } from 'viem';

describe('TargetedMessagingController', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let targetedMessagingDatasource: jest.MockedObjectDeep<ITargetedMessagingDatasource>;

  beforeEach(async () => {
    const moduleFixture = await createTestModule();

    targetedMessagingDatasource = moduleFixture.get(
      ITargetedMessagingDatasource,
    );
    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    jest.resetAllMocks();
    await app.close();
  });

  describe('GET targeted Safe', () => {
    it('should get a targeted Safe', async () => {
      const outreachId = faker.number.int();
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const targetedSafe = targetedSafeBuilder()
        .with('address', safe.address)
        .build();
      targetedMessagingDatasource.getTargetedSafe.mockResolvedValue(
        targetedSafe,
      );

      await request(app.getHttpServer())
        .get(
          `/v1/targeted-messaging/outreaches/${outreachId}/chains/${chain.chainId}/safes/${safe.address}`,
        )
        .expect(200)
        .expect({
          outreachId: targetedSafe.outreachId,
          address: targetedSafe.address,
        });
    });

    it('should return 404 Not Found if the Safe is not targeted', async () => {
      const outreachId = faker.number.int();
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      targetedMessagingDatasource.getTargetedSafe.mockRejectedValue(
        new TargetedSafeNotFoundError(),
      );

      await request(app.getHttpServer())
        .get(
          `/v1/targeted-messaging/outreaches/${outreachId}/chains/${chain.chainId}/safes/${safe.address}`,
        )
        .expect(404);
    });
  });

  describe('GET submissions', () => {
    it('should get a completed submission', async () => {
      const outreachId = faker.number.int();
      const chain = chainBuilder().build();
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const safe = safeBuilder()
        .with('owners', [
          getAddress(faker.finance.ethereumAddress()),
          signerAddress,
        ])
        .build();
      const targetedSafe = targetedSafeBuilder()
        .with('address', safe.address)
        .build();
      const submission = submissionBuilder().build();
      targetedMessagingDatasource.getTargetedSafe.mockResolvedValue(
        targetedSafe,
      );
      targetedMessagingDatasource.getSubmission.mockResolvedValue(submission);
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            return Promise.resolve({
              data: rawify(safe),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/targeted-messaging/outreaches/${outreachId}/chains/${chain.chainId}/safes/${safe.address}/signers/${signerAddress}/submissions`,
        )
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            outreachId: submission.outreachId,
            targetedSafeId: submission.targetedSafeId,
            signerAddress: submission.signerAddress,
            completionDate: submission.completionDate.toISOString(),
          });
        });
    });

    it('should get a non-completed submission', async () => {
      const outreachId = faker.number.int();
      const chain = chainBuilder().build();
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const safe = safeBuilder()
        .with('owners', [
          getAddress(faker.finance.ethereumAddress()),
          signerAddress,
        ])
        .build();
      const targetedSafe = targetedSafeBuilder()
        .with('address', safe.address)
        .build();
      targetedMessagingDatasource.getTargetedSafe.mockResolvedValue(
        targetedSafe,
      );
      targetedMessagingDatasource.getSubmission.mockRejectedValue(
        new SubmissionNotFoundError(),
      );
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            return Promise.resolve({
              data: rawify(safe),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/targeted-messaging/outreaches/${outreachId}/chains/${chain.chainId}/safes/${safe.address}/signers/${signerAddress}/submissions`,
        )
        .expect(200)
        .expect({
          outreachId,
          targetedSafeId: targetedSafe.id,
          signerAddress,
          completionDate: null,
        });
    });

    it('should return 204 No Content if the Safe is not targeted', async () => {
      const outreachId = faker.number.int();
      const chain = chainBuilder().build();
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const safe = safeBuilder()
        .with('owners', [
          getAddress(faker.finance.ethereumAddress()),
          signerAddress,
        ])
        .build();
      targetedMessagingDatasource.getTargetedSafe.mockRejectedValue(
        new TargetedSafeNotFoundError(),
      );

      await request(app.getHttpServer())
        .get(
          `/v1/targeted-messaging/outreaches/${outreachId}/chains/${chain.chainId}/safes/${safe.address}/signers/${signerAddress}/submissions`,
        )
        .expect(204)
        .expect({});
    });

    it('should return 400 Bad Request if the signer is not an owner of the Safe', async () => {
      const outreachId = faker.number.int({ max: DB_MAX_SAFE_INTEGER });
      const chain = chainBuilder().build();
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const safe = safeBuilder()
        .with('owners', [
          // The signer is not an owner
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafe = targetedSafeBuilder()
        .with('address', safe.address)
        .build();
      targetedMessagingDatasource.getTargetedSafe.mockResolvedValue(
        targetedSafe,
      );
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            return Promise.resolve({
              data: rawify(safe),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/targeted-messaging/outreaches/${outreachId}/chains/${chain.chainId}/safes/${safe.address}/signers/${signerAddress}/submissions`,
        )
        .expect(400)
        .expect({
          message: 'The signer is not a Safe owner',
          error: 'Bad Request',
          statusCode: 400,
        });
    });

    it('should not propagate internal errors', async () => {
      const outreachId = faker.number.int();
      const chain = chainBuilder().build();
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const safe = safeBuilder()
        .with('owners', [
          getAddress(faker.finance.ethereumAddress()),
          signerAddress,
        ])
        .build();
      targetedMessagingDatasource.getTargetedSafe.mockRejectedValue(
        new Error('Internal error message that should not be propagated'),
      );

      await request(app.getHttpServer())
        .get(
          `/v1/targeted-messaging/outreaches/${outreachId}/chains/${chain.chainId}/safes/${safe.address}/signers/${signerAddress}/submissions`,
        )
        .expect(500)
        .expect({
          code: 500,
          message: 'Internal server error',
        });
    });
  });

  describe('POST submissions', () => {
    it('should create a submission', async () => {
      const outreachId = faker.number.int();
      const chain = chainBuilder().build();
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const safe = safeBuilder()
        .with('owners', [
          getAddress(faker.finance.ethereumAddress()),
          signerAddress,
        ])
        .build();
      const targetedSafe = targetedSafeBuilder()
        .with('address', safe.address)
        .build();
      const submission = submissionBuilder().build();
      targetedMessagingDatasource.getTargetedSafe.mockResolvedValue(
        targetedSafe,
      );
      targetedMessagingDatasource.getSubmission.mockRejectedValue(
        new SubmissionNotFoundError(),
      );
      targetedMessagingDatasource.createSubmission.mockResolvedValue(
        submission,
      );
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            return Promise.resolve({
              data: rawify(safe),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .post(
          `/v1/targeted-messaging/outreaches/${outreachId}/chains/${chain.chainId}/safes/${safe.address}/signers/${signerAddress}/submissions`,
        )
        .send({ completed: true })
        .expect(201)
        .expect(({ body }) => {
          expect(body).toEqual({
            outreachId,
            targetedSafeId: submission.targetedSafeId,
            signerAddress: submission.signerAddress,
            completionDate: submission.completionDate.toISOString(),
          });
        });
    });

    it('should create a submission for a campaign targeting all Safes', async () => {
      const outreachId = faker.number.int();
      const chain = chainBuilder().build();
      const submission = submissionBuilder().build();
      const safe = safeBuilder()
        .with('owners', [
          getAddress(faker.finance.ethereumAddress()),
          submission.signerAddress,
        ])
        .build();
      const targetedSafe = targetedSafeBuilder()
        .with('address', safe.address)
        .build();
      targetedMessagingDatasource.getTargetedSafe.mockRejectedValue(
        new TargetedSafeNotFoundError(),
      );
      targetedMessagingDatasource.createTargetedSafes.mockResolvedValueOnce([
        targetedSafe,
      ]);
      targetedMessagingDatasource.getSubmission.mockRejectedValue(
        new SubmissionNotFoundError(),
      );
      targetedMessagingDatasource.createSubmission.mockResolvedValueOnce(
        submission,
      );
      targetedMessagingDatasource.getOutreachOrFail.mockResolvedValue({
        id: expect.any(Number),
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
        type: expect.any(String),
        name: expect.any(String),
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        sourceId: expect.any(Number),
        teamName: expect.any(String),
        sourceFile: null,
        sourceFileProcessedDate: null,
        sourceFileChecksum: null,
        targetAll: true,
      });

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            return Promise.resolve({
              data: rawify(safe),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .post(
          `/v1/targeted-messaging/outreaches/${outreachId}/chains/${chain.chainId}/safes/${safe.address}/signers/${submission.signerAddress}/submissions`,
        )
        .send({ completed: true })
        .expect(201)
        .expect(({ body }) => {
          expect(body).toEqual({
            outreachId,
            targetedSafeId: submission.targetedSafeId,
            signerAddress: submission.signerAddress,
            completionDate: submission.completionDate.toISOString(),
          });
        });
    });

    it('should return 422 Unprocessable Entity if payload is not well-formed', async () => {
      const outreachId = faker.number.int();
      const chain = chainBuilder().build();
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .post(
          `/v1/targeted-messaging/outreaches/${outreachId}/chains/${chain.chainId}/safes/${safeAddress}/signers/${signerAddress}/submissions`,
        )
        .send({ invalid: 'body' })
        .expect(422)
        .expect({
          code: 'invalid_type',
          expected: 'boolean',
          message: 'Required',
          path: ['completed'],
          received: 'undefined',
          statusCode: 422,
        });
    });

    it('should return 400 Bad Request if the signer already completed the submission', async () => {
      const outreachId = faker.number.int();
      const chain = chainBuilder().build();
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const safe = safeBuilder()
        .with('owners', [
          getAddress(faker.finance.ethereumAddress()),
          signerAddress,
        ])
        .build();
      const targetedSafe = targetedSafeBuilder()
        .with('address', safe.address)
        .build();
      const submission = submissionBuilder().build();
      targetedMessagingDatasource.getTargetedSafe.mockResolvedValue(
        targetedSafe,
      );
      targetedMessagingDatasource.getSubmission.mockResolvedValue(submission);
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            return Promise.resolve({
              data: rawify(safe),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .post(
          `/v1/targeted-messaging/outreaches/${outreachId}/chains/${chain.chainId}/safes/${safe.address}/signers/${signerAddress}/submissions`,
        )
        .send({ completed: true })
        .expect(400)
        .expect({
          error: 'Bad Request',
          message: 'Submission already exists',
          statusCode: 400,
        });
    });

    it('should return 400 Bad Request if the signer is not an owner of the Safe', async () => {
      const outreachId = faker.number.int();
      const chain = chainBuilder().build();
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const safe = safeBuilder()
        .with('owners', [
          // The signer is not an owner
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafe = targetedSafeBuilder()
        .with('address', safe.address)
        .build();
      const submission = submissionBuilder().build();
      targetedMessagingDatasource.getTargetedSafe.mockResolvedValue(
        targetedSafe,
      );
      targetedMessagingDatasource.getSubmission.mockRejectedValue(
        new SubmissionNotFoundError(),
      );
      targetedMessagingDatasource.createSubmission.mockResolvedValue(
        submission,
      );
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            return Promise.resolve({
              data: rawify(safe),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .post(
          `/v1/targeted-messaging/outreaches/${outreachId}/chains/${chain.chainId}/safes/${safe.address}/signers/${signerAddress}/submissions`,
        )
        .send({ completed: true })
        .expect(400)
        .expect({
          error: 'Bad Request',
          message: 'The signer is not a Safe owner',
          statusCode: 400,
        });
    });

    it('should return 404 Not Found if the Safe is not targeted', async () => {
      const outreachId = faker.number.int();
      const chain = chainBuilder().build();
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      targetedMessagingDatasource.getTargetedSafe.mockRejectedValue(
        new TargetedSafeNotFoundError(),
      );
      targetedMessagingDatasource.getOutreachOrFail.mockResolvedValue({
        id: expect.any(Number),
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
        type: expect.any(String),
        name: expect.any(String),
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        sourceId: expect.any(Number),
        teamName: expect.any(String),
        sourceFile: null,
        sourceFileProcessedDate: null,
        sourceFileChecksum: null,
        targetAll: false,
      });

      await request(app.getHttpServer())
        .post(
          `/v1/targeted-messaging/outreaches/${outreachId}/chains/${chain.chainId}/safes/${safeAddress}/signers/${signerAddress}/submissions`,
        )
        .send({ completed: true })
        .expect(404)
        .expect({
          error: 'Not Found',
          message: 'Targeted Safe not found',
          statusCode: 404,
        });
    });

    it('should not propagate internal errors', async () => {
      const outreachId = faker.number.int();
      const chain = chainBuilder().build();
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      targetedMessagingDatasource.getTargetedSafe.mockRejectedValue(
        new Error('Internal error message that should not be propagated'),
      );

      await request(app.getHttpServer())
        .post(
          `/v1/targeted-messaging/outreaches/${outreachId}/chains/${chain.chainId}/safes/${safeAddress}/signers/${signerAddress}/submissions`,
        )
        .send({ completed: true })
        .expect(500)
        .expect({
          code: 500,
          message: 'Internal server error',
        });
    });
  });
});
