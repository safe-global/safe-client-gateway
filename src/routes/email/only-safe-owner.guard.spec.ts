import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { OnlySafeOwner } from '@/routes/email/only-safe-owner.guard';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { Test, TestingModule } from '@nestjs/testing';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Hash } from 'viem';

const safeRepository = {
  isOwner: jest.fn(),
} as unknown as ISafeRepository;

const safeRepositoryMock = jest.mocked(safeRepository);

@Controller()
class TestController {
  @Post('test/:chainId/:safeAddress')
  @HttpCode(200)
  @UseGuards(OnlySafeOwner)
  async onlySafeOwnerRoute() {}

  @Post('test/invalid/chains/:chainId')
  @HttpCode(200)
  @UseGuards(OnlySafeOwner)
  async invalidRouteWithChainId() {}

  @Post('test/invalid/safes/:safeAddress')
  @HttpCode(200)
  @UseGuards(OnlySafeOwner)
  async invalidRouteWithSafeAddress() {}
}

describe('OnlySafeOwner guard tests', () => {
  let app;

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const signer = account.address;
  const message = faker.word.words();
  let signature: Hash;

  beforeAll(async () => {
    signature = await account.signMessage({ message });
  });

  beforeEach(async () => {
    jest.resetAllMocks();
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

  it('returns 403 on empty body', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();

    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safeAddress}`)
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });

    expect(safeRepositoryMock.isOwner).toBeCalledTimes(0);
  });

  it('returns 200 on a valid signature from an owner', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    safeRepositoryMock.isOwner.mockResolvedValue(true);

    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safeAddress}`)
      .send({
        signature,
        message,
        address: signer,
      })
      .expect(200);

    expect(safeRepositoryMock.isOwner).toBeCalledTimes(1);
  });

  it('returns 403 on an invalid signature from an owner', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const message = 'This is a different test';

    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safeAddress}`)
      .send({
        signature,
        message,
        address: signer,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });

    expect(safeRepositoryMock.isOwner).toBeCalledTimes(0);
  });

  it('returns 403 on a valid signature from a non-owner', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    safeRepositoryMock.isOwner.mockResolvedValue(false);

    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safeAddress}`)
      .send({
        signature,
        message,
        address: signer,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });

    expect(safeRepositoryMock.isOwner).toBeCalledTimes(1);
  });

  it('returns 403 if the address is missing from payload', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();

    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safeAddress}`)
      .send({
        signature,
        message,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });

    expect(safeRepositoryMock.isOwner).toBeCalledTimes(0);
  });

  it('returns 403 if the message is missing from payload', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();

    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safeAddress}`)
      .send({
        signature,
        address: signer,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });

    expect(safeRepositoryMock.isOwner).toBeCalledTimes(0);
  });

  it('returns 403 if the signature is missing from payload', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();

    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safeAddress}`)
      .send({
        message: message,
        address: signer,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });

    expect(safeRepositoryMock.isOwner).toBeCalledTimes(0);
  });

  it('returns 403 on routes without safe address', async () => {
    const chainId = faker.string.numeric();

    await request(app.getHttpServer())
      .post(`/test/invalid/chains/${chainId}`)
      .send({
        signature,
        message,
        address: signer,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });

    expect(safeRepositoryMock.isOwner).toBeCalledTimes(0);
  });

  it('returns 403 on routes without chain id', async () => {
    const safeAddress = faker.finance.ethereumAddress();

    await request(app.getHttpServer())
      .post(`/test/invalid/safes/${safeAddress}`)
      .send({
        signature,
        message: message,
        address: signer,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });

    expect(safeRepositoryMock.isOwner).toBeCalledTimes(0);
  });
});
