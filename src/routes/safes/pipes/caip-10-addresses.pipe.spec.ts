import { TestAppProvider } from '@/__tests__/test-app.provider';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/configuration';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { Caip10AddressesPipe } from '@/routes/safes/pipes/caip-10-addresses.pipe';
import { faker } from '@faker-js/faker';
import { Controller, Get, INestApplication, Query } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';
import { getAddress } from 'viem';

@Controller()
class TestController {
  @Get('test')
  async route(
    @Query('addresses', new Caip10AddressesPipe())
    addresses: Array<{ chainId: string; address: string }>,
  ): Promise<Array<{ chainId: string; address: string }>> {
    return addresses;
  }
}

describe('Caip10AddressesPipe', () => {
  let app: INestApplication;

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

  it('returns parsed, checksummed CAIP-10 addresses', async () => {
    const chainId1 = faker.string.numeric();
    const chainId2 = faker.string.numeric();
    const chainId3 = faker.string.numeric();
    const address1 = faker.finance.ethereumAddress();
    const address2 = faker.finance.ethereumAddress();
    const address3 = faker.finance.ethereumAddress();

    await request(app.getHttpServer())
      .get(
        `/test?addresses=${chainId1}:${address1},${chainId2}:${address2},${chainId3}:${address3}`,
      )
      .expect(200)
      .expect([
        { chainId: chainId1, address: getAddress(address1) },
        { chainId: chainId2, address: getAddress(address2) },
        { chainId: chainId3, address: getAddress(address3) },
      ]);
  });

  it('throws for missing params', async () => {
    await request(app.getHttpServer()).get('/test?addresses=').expect(500);
  });

  it('throws for missing chainIds', async () => {
    await request(app.getHttpServer()).get('/test?addresses=:').expect(500);
  });

  it('throws for missing addresses', async () => {
    const chainId = faker.string.numeric();

    await request(app.getHttpServer())
      .get(`/test?addresses=${chainId}:`)
      .expect(500);
  });
});
