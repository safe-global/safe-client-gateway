import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import { getDataDecodedDtoBuilder } from '@/routes/data-decode/entities/__tests__/get-data-decoded.dto.builder';
import { CacheKeyPrefix } from '@/datasources/cache/constants';

describe('Data decode e2e tests', () => {
  let app: INestApplication;
  const chainId = '1'; // Mainnet

  beforeAll(async () => {
    const cacheKeyPrefix = crypto.randomUUID();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register()],
    })
      .overrideProvider(CacheKeyPrefix)
      .useValue(cacheKeyPrefix)
      .compile();

    app = await new TestAppProvider().provide(moduleRef);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /data-decoder', async () => {
    const getDataDecodedDto = getDataDecodedDtoBuilder()
      .with(
        'data',
        '0x8d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004a60031369c6ecb549c117aff789ad66c708a452296740000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000ccd7c90b85e48682a68e7db1dc1f0339ea46ab020000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000c20aef7964d6c3c966e3ae9e850aee9db81792e30000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000000000000bccd4163a8d714eaae683af53accc389fd73fdd0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000d50ef7b662a07d3fc934891e488b133313cbfd7d0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000e90975bd7b1937dfa4bf3d9c41368a07255607050000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000e817579b91ae59512ebdb860146001d170018e550000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000000000006cd68754b97db054b68397e27ddcdc16d27afb220000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000000000002ab2231d49154bb22b58df44b122ef9ba3ae97990000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000000000001ea33eb00f2c2f00e1021fd7e9dd22154c82b06f0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000844d2c79c4a721cbe153b092ba75b4c1e7cb2bc30000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000182ff57e69ec50eff8fc4a9e19e4d02d75061d320000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000b07d074825596798f6e127f86825aafaa81cdd7e0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000d39d0a6b980218038c4675310399cecebb54de600000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      )
      .with('to', '0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761')
      .build();
    const expectedResponse: DataDecoded = {
      method: 'multiSend',
      parameters: [
        {
          name: 'transactions',
          type: 'bytes',
          value:
            '0x0031369c6ecb549c117aff789ad66c708a452296740000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000ccd7c90b85e48682a68e7db1dc1f0339ea46ab020000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000c20aef7964d6c3c966e3ae9e850aee9db81792e30000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000000000000bccd4163a8d714eaae683af53accc389fd73fdd0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000d50ef7b662a07d3fc934891e488b133313cbfd7d0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000e90975bd7b1937dfa4bf3d9c41368a07255607050000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000e817579b91ae59512ebdb860146001d170018e550000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000000000006cd68754b97db054b68397e27ddcdc16d27afb220000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000000000002ab2231d49154bb22b58df44b122ef9ba3ae97990000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000000000001ea33eb00f2c2f00e1021fd7e9dd22154c82b06f0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000844d2c79c4a721cbe153b092ba75b4c1e7cb2bc30000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000182ff57e69ec50eff8fc4a9e19e4d02d75061d320000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000b07d074825596798f6e127f86825aafaa81cdd7e0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000d39d0a6b980218038c4675310399cecebb54de600000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000000000',
          valueDecoded: [
            {
              operation: 0,
              to: '0x31369C6ECB549C117aFF789Ad66C708A45229674',
              value: '1000000000000000000',
              data: null,
              dataDecoded: null,
            },
            {
              operation: 0,
              to: '0xccd7C90B85e48682A68E7Db1dC1F0339EA46Ab02',
              value: '1000000000000000000',
              data: null,
              dataDecoded: null,
            },
            {
              operation: 0,
              to: '0xc20AeF7964d6c3C966E3Ae9E850aEe9DB81792E3',
              value: '1000000000000000000',
              data: null,
              dataDecoded: null,
            },
            {
              operation: 0,
              to: '0x0bCcD4163a8D714EAAE683AF53accC389Fd73FDD',
              value: '1000000000000000000',
              data: null,
              dataDecoded: null,
            },
            {
              operation: 0,
              to: '0xD50EF7b662A07d3fc934891e488B133313cBFd7d',
              value: '1000000000000000000',
              data: null,
              dataDecoded: null,
            },
            {
              operation: 0,
              to: '0xe90975BD7B1937DfA4BF3d9c41368a0725560705',
              value: '1000000000000000000',
              data: null,
              dataDecoded: null,
            },
            {
              operation: 0,
              to: '0xE817579b91aE59512EbdB860146001D170018e55',
              value: '1000000000000000000',
              data: null,
              dataDecoded: null,
            },
            {
              operation: 0,
              to: '0x6cD68754B97DB054b68397E27ddcdC16D27AfB22',
              value: '1000000000000000000',
              data: null,
              dataDecoded: null,
            },
            {
              operation: 0,
              to: '0x2ab2231D49154bB22b58df44B122ef9BA3Ae9799',
              value: '1000000000000000000',
              data: null,
              dataDecoded: null,
            },
            {
              operation: 0,
              to: '0x1ea33eb00F2C2F00e1021FD7E9dD22154C82b06F',
              value: '1000000000000000000',
              data: null,
              dataDecoded: null,
            },
            {
              operation: 0,
              to: '0x844d2C79C4a721CBe153B092bA75B4c1E7Cb2BC3',
              value: '1000000000000000000',
              data: null,
              dataDecoded: null,
            },
            {
              operation: 0,
              to: '0x182FF57E69eC50eFF8fc4a9E19e4d02D75061D32',
              value: '1000000000000000000',
              data: null,
              dataDecoded: null,
            },
            {
              operation: 0,
              to: '0xB07d074825596798f6e127f86825AAFaA81Cdd7e',
              value: '1000000000000000000',
              data: null,
              dataDecoded: null,
            },
            {
              operation: 0,
              to: '0xd39d0a6b980218038C4675310399cecEbb54DE60',
              value: '1000000000000000000',
              data: null,
              dataDecoded: null,
            },
          ],
        },
      ],
    };

    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/data-decoder`)
      .send(getDataDecodedDto)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(expectedResponse);
      });
  });

  it('POST /data-decoder should throw a validation error', async () => {
    const getDataDecodedDto = getDataDecodedDtoBuilder().build();

    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/data-decoder`)
      .send({ ...getDataDecodedDto, to: faker.number.int() })
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['to'],
        message: 'Expected string, received number',
      });
  });

  it('POST /data-decoder should throw a validation error (2)', async () => {
    const getDataDecodedDto = getDataDecodedDtoBuilder().build();

    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/data-decoder`)
      .send({ ...getDataDecodedDto, to: faker.string.alphanumeric() })
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'custom',
        path: ['to'],
        message: 'Invalid address',
      });
  });
});
