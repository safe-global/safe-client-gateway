import {
  Controller,
  HttpCode,
  INestApplication,
  Post,
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
import { EmailRegistrationGuard } from '@/routes/email/guards/email-registration.guard';

@Controller()
class TestController {
  @Post('test/:chainId/:safeAddress')
  @HttpCode(200)
  @UseGuards(EmailRegistrationGuard)
  async validRoute(): Promise<void> {}

  @Post('test/invalid/chains/:chainId')
  @HttpCode(200)
  @UseGuards(EmailRegistrationGuard)
  async invalidRouteWithChainId(): Promise<void> {}

  @Post('test/invalid/safes/:safeAddress')
  @HttpCode(200)
  @UseGuards(EmailRegistrationGuard)
  async invalidRouteWithSafeAddress(): Promise<void> {}
}

describe('EmailRegistration guard tests', () => {
  let app: INestApplication;

  const chainId = faker.string.numeric();
  const safe = faker.finance.ethereumAddress();
  const emailAddress = faker.internet.email();
  const timestamp = faker.date.recent().getTime();
  const privateKey = generatePrivateKey();
  const signer = privateKeyToAccount(privateKey);
  const signerAddress = signer.address;
  let signature: Hash;

  beforeAll(async () => {
    const message = `email-register-${chainId}-${safe}-${emailAddress}-${signerAddress}-${timestamp}`;
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

  it('returns 403 on empty body', async () => {
    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safe}`)
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 200 on a valid signature', async () => {
    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safe}`)
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        emailAddress: emailAddress,
        signer: signerAddress,
      })
      .expect(200);
  });

  it('returns 403 on an invalid signature', async () => {
    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safe}`)
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        emailAddress: faker.internet.email(), // different email should have different signature
        account: signerAddress,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 if the email address is missing from payload', async () => {
    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safe}`)
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        account: signerAddress,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 if the account is missing from payload', async () => {
    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safe}`)
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        emailAddress,
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
      .post(`/test/${chainId}/${safe}`)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        emailAddress,
        account: signerAddress,
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
      .post(`/test/${chainId}/${safeAddress}`)
      .set('Safe-Wallet-Signature', signature)
      .send({
        emailAddress,
        account: signerAddress,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 on routes without safe address', async () => {
    const chainId = faker.string.numeric();

    await request(app.getHttpServer())
      .post(`/test/invalid/chains/${chainId}`)
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        emailAddress,
        account: signerAddress,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 on routes without chain id', async () => {
    const safeAddress = faker.finance.ethereumAddress();

    await request(app.getHttpServer())
      .post(`/test/invalid/safes/${safeAddress}`)
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .send({
        emailAddress,
        account: signerAddress,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });
});
