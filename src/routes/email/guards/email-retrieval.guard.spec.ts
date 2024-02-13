import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Hash } from 'viem';
import { EmailRetrievalGuard } from '@/routes/email/guards/email-retrieval.guard';

@Controller()
class TestController {
  @Get('test/:chainId/:safeAddress/:signer')
  @UseGuards(EmailRetrievalGuard)
  async validRoute(): Promise<void> {}

  @Get('test/invalid/1/:chainId/:safeAddress')
  @UseGuards(EmailRetrievalGuard)
  async invalidRouteWithoutSigner(): Promise<void> {}

  @Get('test/invalid/2/:chainId/:signer')
  @UseGuards(EmailRetrievalGuard)
  async invalidRouteWithoutSafeAddress(): Promise<void> {}

  @Get('test/invalid/3/:safeAddress/:signer')
  @UseGuards(EmailRetrievalGuard)
  async invalidRouteWithoutChainId(): Promise<void> {}
}

describe('EmailRetrievalGuard tests', () => {
  let app: INestApplication;

  const chainId = faker.string.numeric();
  const safe = faker.finance.ethereumAddress();
  const timestamp = faker.date.recent().getTime();
  const privateKey = generatePrivateKey();
  const signer = privateKeyToAccount(privateKey);
  let signature: Hash;

  beforeAll(async () => {
    const message = `email-retrieval-${chainId}-${safe}-${signer.address}-${timestamp}`;
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

  it('returns 403 if Safe-Wallet-Signature is missing', async () => {
    await request(app.getHttpServer())
      .get(`/test/${chainId}/${safe}/${signer.address}`)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 if Safe-Wallet-Signature-Timestamp is missing', async () => {
    await request(app.getHttpServer())
      .get(`/test/${chainId}/${safe}/${signer.address}`)
      .set('Safe-Wallet-Signature', signature)
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 200 on a valid signature', async () => {
    await request(app.getHttpServer())
      .get(`/test/${chainId}/${safe}/${signer.address}`)
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .expect(200);
  });

  it('returns 403 on an invalid signature', async () => {
    await request(app.getHttpServer())
      .get(`/test/${chainId}/${safe}/${signer}`)
      .set('Safe-Wallet-Signature', faker.string.sample(32))
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 on routes without signer', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();

    await request(app.getHttpServer())
      .get(`/test/invalid/1/${chainId}/${safeAddress}`)
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 on routes without safe address', async () => {
    const chainId = faker.string.numeric();
    const signer = faker.finance.ethereumAddress();

    await request(app.getHttpServer())
      .get(`/test/invalid/2/${chainId}/${signer}`)
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 on routes without chain id', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const signer = faker.finance.ethereumAddress();

    await request(app.getHttpServer())
      .get(`/test/invalid/3/${safeAddress}/${signer}`)
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });
});
