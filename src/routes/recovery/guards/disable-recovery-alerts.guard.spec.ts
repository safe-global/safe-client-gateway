import {
  Controller,
  Delete,
  INestApplication,
  UseGuards,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Hash } from 'viem';
import { DisableRecoveryAlertsGuard } from '@/routes/recovery/guards/disable-recovery-alerts.guard';

@Controller()
class TestController {
  @Delete('test/:chainId/:safeAddress/:moduleAddress')
  @UseGuards(DisableRecoveryAlertsGuard)
  async validRouteWithSigner(): Promise<void> {}

  @Delete('test/invalid/1/chains/:safeAddress/:moduleAddress')
  @UseGuards(DisableRecoveryAlertsGuard)
  async invalidRouteWithoutChainId(): Promise<void> {}

  @Delete('test/invalid/2/:chainId/:moduleAddress')
  @UseGuards(DisableRecoveryAlertsGuard)
  async invalidRouteWithoutSafeAddress(): Promise<void> {}

  @Delete('test/invalid/3/:chainId/:safeAddress')
  @UseGuards(DisableRecoveryAlertsGuard)
  async invalidRouteWithoutModuleAddress(): Promise<void> {}
}

describe('DisableRecoveryAlertsGuard guard tests', () => {
  let app: INestApplication;

  const chainId = faker.string.numeric();
  const safeAddress = faker.finance.ethereumAddress();
  const timestamp = faker.date.recent().getTime();
  const privateKey = generatePrivateKey();
  const signer = privateKeyToAccount(privateKey);
  const moduleAddress = faker.finance.ethereumAddress();
  let signature: Hash;

  beforeAll(async () => {
    const message = `disable-recovery-alerts-${chainId}-${safeAddress}-${moduleAddress}-${signer.address}-${timestamp}`;
    signature = await signer.signMessage({ message });
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestLoggingModule, ConfigurationModule.register(configuration)],
      controllers: [TestController],
    }).compile();
    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 for a valid signature', async () => {
    await request(app.getHttpServer())
      .delete(`/test/${chainId}/${safeAddress}/${moduleAddress}`)
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        moduleAddress,
        signer: signer.address,
      })
      .expect(200);
  });

  it('returns 403 for an invalid signature', async () => {
    const invalidSignature = await signer.signMessage({
      message: 'some invalid message',
    });

    await request(app.getHttpServer())
      .delete(`/test/${chainId}/${safeAddress}/${moduleAddress}`)
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

  it('returns 403 on routes without the moduleAddress', async () => {
    const invalidSignature = await signer.signMessage({
      message: 'some invalid message',
    });

    await request(app.getHttpServer())
      .delete(`/test/invalid/3/${chainId}/${safeAddress}`)
      .set('Safe-Wallet-Signature', invalidSignature)
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
      .delete(`/test/${chainId}/${safeAddress}/${moduleAddress}`)
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
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();

    await request(app.getHttpServer())
      .delete(`/test/${chainId}/${safeAddress}/${moduleAddress}`)
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
      .delete(`/test/invalid/1/chains/${safeAddress}/${moduleAddress}`)
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

  it('returns 403 on routes without safe address', async () => {
    await request(app.getHttpServer())
      .delete(`/test/invalid/2/${chainId}/${moduleAddress}`)
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
      .delete(`/test/invalid/3/${chainId}/${safeAddress}`)
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
