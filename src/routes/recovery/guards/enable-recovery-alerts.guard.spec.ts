import { Controller, INestApplication, Post, UseGuards } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Hash, getAddress } from 'viem';
import { EnableRecoveryAlertsGuard } from '@/routes/recovery/guards/enable-recovery-alerts.guard';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';

const safeRepository = {
  getSafesByModule: jest.fn(),
} as jest.MockedObjectDeep<ISafeRepository>;
const safeRepositoryMock = jest.mocked(safeRepository);

@Controller()
class TestController {
  @Post('test/:chainId/:safeAddress')
  @UseGuards(EnableRecoveryAlertsGuard)
  async validRoute(): Promise<void> {}

  @Post('test/invalid/1/chains/:safeAddress')
  @UseGuards(EnableRecoveryAlertsGuard)
  async invalidRouteWithoutChainId(): Promise<void> {}

  @Post('test/invalid/2/:chainId')
  @UseGuards(EnableRecoveryAlertsGuard)
  async invalidRouteWithoutSafeAddress(): Promise<void> {}
}

describe('EnableRecoveryAlertsGuard guard tests', () => {
  let app: INestApplication;

  const chainId = faker.string.numeric();
  const safeAddress = faker.finance.ethereumAddress();
  const timestamp = faker.date.recent().getTime();
  const privateKey = generatePrivateKey();
  const signer = privateKeyToAccount(privateKey);
  const moduleAddress = faker.finance.ethereumAddress();
  let signature: Hash;

  beforeAll(async () => {
    const message = `enable-recovery-alerts-${chainId}-${safeAddress}-${moduleAddress}-${signer.address}-${timestamp}`;
    signature = await signer.signMessage({ message });
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestLoggingModule, ConfigurationModule.register(configuration)],
      controllers: [TestController],
      providers: [
        {
          provide: ISafeRepository,
          useValue: safeRepositoryMock,
        },
      ],
    }).compile();
    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 201 for a valid signature for module on given Safe', async () => {
    safeRepositoryMock.getSafesByModule.mockResolvedValue({
      safes: [getAddress(safeAddress)],
    });

    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safeAddress}`)
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        moduleAddress,
        signer: signer.address,
      })
      .expect(201);
  });

  it('returns 403 for a valid signature for module not on given Safe', async () => {
    safeRepositoryMock.getSafesByModule.mockResolvedValue({
      safes: [],
    });

    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safeAddress}`)
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        moduleAddress,
        signer: signer.address,
      })
      .expect(403);
  });

  it('returns 403 for an invalid signature', async () => {
    const invalidSignature = await signer.signMessage({
      message: 'some invalid message',
    });

    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safeAddress}`)
      .set('Safe-Wallet-Signature', invalidSignature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        moduleAddress,
        signer: signer.address,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 if the moduleAddress is missing from payload', async () => {
    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safeAddress}`)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        signer: signer.address,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 if the signature is missing from payload', async () => {
    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safeAddress}`)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        moduleAddress,
        signer: signer.address,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 if the timestamp is missing from payload', async () => {
    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safeAddress}`)
      .set('Safe-Wallet-Signature', signature)
      .send({
        moduleAddress,
        signer: signer.address,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 on routes without chain id', async () => {
    await request(app.getHttpServer())
      .post(`/test/invalid/1/chains/${safeAddress}`)
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        moduleAddress,
        signer: signer.address,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 on routes without safeAddress', async () => {
    await request(app.getHttpServer())
      .post(`/test/invalid/2/${chainId}`)
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        moduleAddress,
        signer: signer.address,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 if the signer is missing from the payload', async () => {
    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safeAddress}`)
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        moduleAddress,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });
});
