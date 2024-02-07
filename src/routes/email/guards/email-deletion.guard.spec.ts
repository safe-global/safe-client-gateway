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
import { EmailDeletionGuard } from '@/routes/email/guards/email-deletion.guard';

@Controller()
class TestController {
  @Delete('test/:chainId/:safeAddress/:signer')
  @UseGuards(EmailDeletionGuard)
  async validRoute(): Promise<void> {}

  @Delete('test/invalid/1/chains/:safeAddress/:signer')
  @UseGuards(EmailDeletionGuard)
  async invalidRouteWithoutChainId(): Promise<void> {}

  @Delete('test/invalid/2/:chainId/:signer')
  @UseGuards(EmailDeletionGuard)
  async invalidRouteWithoutSafeAddress(): Promise<void> {}

  @Delete('test/invalid/3/:chainId/:safeAddress/')
  @UseGuards(EmailDeletionGuard)
  async invalidRouteWithoutSigner(): Promise<void> {}
}

describe('EmailDeletionGuard guard tests', () => {
  let app: INestApplication;

  const chainId = faker.string.numeric();
  const safe = faker.finance.ethereumAddress();
  const timestamp = faker.date.recent().getTime();
  const privateKey = generatePrivateKey();
  const signer = privateKeyToAccount(privateKey);
  const signerAddress = signer.address;
  let signature: Hash;

  beforeAll(async () => {
    const message = `email-delete-${chainId}-${safe}-${signerAddress}-${timestamp}`;
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

  it('returns 200 on a valid signature', async () => {
    await request(app.getHttpServer())
      .delete(`/test/${chainId}/${safe}/${signer.address}`)
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        signer: signerAddress,
      })
      .expect(200);
  });

  it('returns 403 on an invalid signature', async () => {
    const invalidSignature = await signer.signMessage({
      message: 'some invalid message',
    });

    await request(app.getHttpServer())
      .delete(`/test/${chainId}/${safe}/${signer.address}`)
      .set('Safe-Wallet-Signature', invalidSignature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 if the signature is missing from payload', async () => {
    await request(app.getHttpServer())
      .delete(`/test/${chainId}/${safe}/${signer.address}`)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
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
      .delete(`/test/${chainId}/${safeAddress}/${signer.address}`)
      .set('Safe-Wallet-Signature', signature)
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 on routes without chain id', async () => {
    await request(app.getHttpServer())
      .delete(`/test/invalid/1/chains/${safe}/${signer.address}`)
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 on routes without safe address', async () => {
    await request(app.getHttpServer())
      .delete(`/test/invalid/2/${chainId}/${signer.address}`)
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 on routes without signer', async () => {
    await request(app.getHttpServer())
      .delete(`/test/invalid/3/${chainId}/${safe}/`)
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });
});
