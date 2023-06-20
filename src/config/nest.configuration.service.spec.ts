import { NestConfigurationService } from './nest.configuration.service';
import { ConfigService } from '@nestjs/config';
import { faker } from '@faker-js/faker';

const configService = {
  get: jest.fn(),
  getOrThrow: jest.fn(),
} as unknown as ConfigService;
const configServiceMock = jest.mocked(configService);

describe('NestConfigurationService', () => {
  let target: NestConfigurationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    target = new NestConfigurationService(configServiceMock);
  });

  it(`get key is successful`, async () => {
    const key = faker.string.sample();
    const value = { some: { value: 10 } };
    configServiceMock.get.mockReturnValue(value);

    const result = target.get(key);

    expect(configServiceMock.get).toBeCalledTimes(1);
    expect(configServiceMock.get).toBeCalledWith(key);
    expect(configServiceMock.getOrThrow).toBeCalledTimes(0);
    expect(result).toBe(value);
  });

  it(`get key returns undefined when no key is found`, async () => {
    const key = faker.string.sample();
    configServiceMock.get.mockReturnValue(undefined);

    const result = target.get(key);

    expect(configServiceMock.get).toBeCalledTimes(1);
    expect(configServiceMock.get).toBeCalledWith(key);
    expect(configServiceMock.getOrThrow).toBeCalledTimes(0);
    expect(result).toBe(undefined);
  });

  it(`getOrThrow key is successful`, async () => {
    const key = faker.string.sample();
    const value = { some: { value: 10 } };
    configServiceMock.getOrThrow.mockReturnValue(value);

    const result = target.getOrThrow(key);

    expect(configServiceMock.getOrThrow).toBeCalledTimes(1);
    expect(configServiceMock.getOrThrow).toBeCalledWith(key);
    expect(configServiceMock.get).toBeCalledTimes(0);
    expect(result).toBe(value);
  });

  it(`getOrThrow key throws error`, async () => {
    const key = faker.string.sample();
    configServiceMock.getOrThrow.mockImplementation(() => {
      throw new Error('some error');
    });

    expect(() => {
      target.getOrThrow(key);
    }).toThrow('some error');

    expect(configServiceMock.getOrThrow).toBeCalledTimes(1);
    expect(configServiceMock.getOrThrow).toBeCalledWith(key);
    expect(configServiceMock.get).toBeCalledTimes(0);
  });
});
