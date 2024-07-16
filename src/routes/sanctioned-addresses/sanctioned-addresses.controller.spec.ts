import { INestApplication } from '@nestjs/common';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { Test, TestingModule } from '@nestjs/testing';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { Server } from 'net';
import { faker } from '@faker-js/faker';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import { getAddress } from 'viem';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import request from 'supertest';

describe('Sanctioned Addresses Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let fakeCacheService: FakeCacheService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration)],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .compile();

    networkService = moduleFixture.get(NetworkService);
    fakeCacheService = moduleFixture.get(CacheService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/sanctioned-addresses', () => {
    it('should populate then return cached sanctioned addresses', async () => {
      // Lowercase to check checksumming occurs on response
      const address1 = faker.finance.ethereumAddress().toLowerCase();
      const address2 = faker.finance.ethereumAddress().toLowerCase();
      const xml = `<?xml version="1.0" standalone="yes"?>
<sdnList
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xmlns="https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/XML">
	<publshInformation>
		<Publish_Date>${faker.date.recent()}</Publish_Date>
		<Record_Count>${faker.string.numeric()}</Record_Count>
	</publshInformation>
	<sdnEntry>
		<uid>${faker.string.numeric()}</uid>
		<firstName>${faker.person.firstName()}</firstName>
		<lastName>${faker.person.lastName()}</lastName>
		<sdnType>Individual</sdnType>
		<remarks>(Linked To: ${faker.person.lastName()}, ${faker.person.firstName()}; Linked To: ${faker.company.name()})</remarks>
		<programList>
			<program>${faker.location.country()}-EO14024</program>
		</programList>
		<idList>
			<id>
				<uid>${faker.string.numeric()}</uid>
				<idType>Passport</idType>
				<idNumber>${faker.string.alphanumeric()}</idNumber>
				<idCountry>${faker.location.country()}</idCountry>
			</id>
			<id>
				<uid>${faker.string.numeric}</uid>
				<idType>Tax ID No.</idType>
				<idNumber>${faker.string.numeric}</idNumber>
				<idCountry>${faker.location.country()}</idCountry>
			</id>
			<id>
				<uid>${faker.string.numeric()}</uid>
				<idType>Gender</idType>
				<idNumber>Male</idNumber>
			</id>
			<id>
				<uid>${faker.string.numeric()}</uid>
				<idType>Digital Currency Address - XBT</idType>
				<idNumber>${faker.string.alphanumeric({ length: 42 })}</idNumber>
			</id>
			<id>
				<uid>${faker.string.numeric()}</uid>
				<idType>Digital Currency Address - ETH</idType>
				<idNumber>${address1}</idNumber>
			</id>
			<id>
				<uid>${faker.string.numeric()}</uid>
				<idType>Digital Currency Address - ETH</idType>
				<idNumber>${address2}</idNumber>
			</id>
			<id>
				<uid>${faker.string.numeric()}</uid>
				<idType>Secondary sanctions risk:</idType>
				<idNumber>See Section 11 of Executive Order 14024.</idNumber>
			</id>
		</idList>
		<akaList>
			<aka>
				<uid>${faker.string.numeric()}</uid>
				<type>a.k.a.</type>
				<category>strong</category>
				<lastName>${faker.person.lastName()}</lastName>
				<firstName>${faker.person.firstName()}</firstName>
			</aka>
			<aka>
				<uid>${faker.string.numeric()}</uid>
				<type>a.k.a.</type>
				<category>strong</category>
				<lastName>${faker.person.lastName()}</lastName>
				<firstName>${faker.person.firstName()}</firstName>
			</aka>
		</akaList>
		<addressList>
			<address>
				<uid>${faker.string.numeric()}</uid>
				<country>${faker.location.country()}</country>
			</address>
		</addressList>
		<nationalityList>
			<nationality>
				<uid>${faker.string.numeric()}</uid>
				<country>${faker.location.country()}</country>
				<mainEntry>true</mainEntry>
			</nationality>
			<nationality>
				<uid>${faker.string.numeric()}</uid>
				<country>${faker.location.country()}</country>
				<mainEntry>false</mainEntry>
			</nationality>
			<nationality>
				<uid>${faker.string.numeric()}</uid>
				<country>${faker.location.country()}</country>
				<mainEntry>false</mainEntry>
			</nationality>
		</nationalityList>
		<dateOfBirthList>
			<dateOfBirthItem>
				<uid>${faker.string.numeric()}</uid>
				<dateOfBirth>${faker.date.past()}</dateOfBirth>
				<mainEntry>true</mainEntry>
			</dateOfBirthItem>
		</dateOfBirthList>
		<placeOfBirthList>
			<placeOfBirthItem>
				<uid>${faker.string.numeric()}</uid>
				<placeOfBirth>${faker.location.city()}, ${faker.location.country()}</placeOfBirth>
				<mainEntry>true</mainEntry>
			</placeOfBirthItem>
		</placeOfBirthList>
	</sdnEntry>
</sdnList>`;
      networkService.get.mockResolvedValue({ status: 200, data: xml });
      const expected = [getAddress(address1), getAddress(address2)];

      await request(app.getHttpServer())
        .get('/v1/sanctioned-addresses')
        .expect(200)
        .expect(expected);
      expect(networkService.get).toHaveBeenCalled();
      expect(fakeCacheService.keyCount()).toBe(1);
      await expect(
        fakeCacheService.get(new CacheDir('sanctioned_addresses', '')),
      ).resolves.toEqual(JSON.stringify(expected));
    });

    it('should return sanctioned addresses from cache', async () => {
      const addresses = [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
      ];
      const cacheDir = new CacheDir('sanctioned_addresses', '');
      await fakeCacheService.set(cacheDir, JSON.stringify(addresses), 1);

      await request(app.getHttpServer())
        .get('/v1/sanctioned-addresses')
        .expect(200)
        .expect(addresses);
      expect(networkService.get).not.toHaveBeenCalled();
    });
  });
});
