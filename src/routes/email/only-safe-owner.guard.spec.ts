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
  // The following address, message and signature represent a valid combination of parameters for validation
  const testAddress = '0x21509ab252a92b180c539e4d84ea1406f0f87fb8';
  const testMessage = 'This is a test';
  const testSignature =
    '0xcf103c6090c344ffdaa7635d1c41078c5702fd8a8c0528cd980f28c10fb7b3275b7bd803cc99316fc42bf803dcaf982e078d94b094afb3f9853f0dd7ce888aea1c';

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
        signature: testSignature,
        message: testMessage,
        address: testAddress,
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
        signature: testSignature,
        message,
        address: testAddress,
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
        signature: testSignature,
        message: testMessage,
        address: testAddress,
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
        signature: testSignature,
        message: testMessage,
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
        signature: testSignature,
        address: testAddress,
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
        message: testMessage,
        address: testAddress,
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
        signature: testSignature,
        message: testMessage,
        address: testAddress,
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
        signature: testSignature,
        message: testMessage,
        address: testAddress,
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
