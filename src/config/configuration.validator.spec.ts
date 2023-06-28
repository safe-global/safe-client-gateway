import { faker } from '@faker-js/faker';
import { validate } from './configuration.validator';
import { fakeJson } from '../__tests__/faker';

describe('Configuration validator', () => {
  it('should bypass this validation on tests', () => {
    process.env.NODE_ENV = 'test';
    const expected = JSON.parse(fakeJson());
    const validated = validate(expected);
    expect(validated).toBe(expected);
  });

  it('should detect missing mandatory configuration in production environment', () => {
    process.env.NODE_ENV = 'production';
    expect(() => validate(JSON.parse(fakeJson()))).toThrow(
      /must have required property 'AUTH_TOKEN'.*must have required property 'EXCHANGE_API_KEY'/,
    );
  });

  it('should an invalid LOG_LEVEL configuration in production environment', () => {
    process.env.NODE_ENV = 'production';
    expect(() =>
      validate({
        ...JSON.parse(fakeJson()),
        AUTH_TOKEN: faker.string.uuid(),
        EXCHANGE_API_KEY: faker.string.uuid(),
        LOG_LEVEL: faker.word.words(),
      }),
    ).toThrow(/LOG_LEVEL must be equal to one of the allowed values/);
  });

  it('should return the input configuration if validated in production environment', () => {
    process.env.NODE_ENV = 'production';
    const expected = {
      ...JSON.parse(fakeJson()),
      AUTH_TOKEN: faker.string.uuid(),
      EXCHANGE_API_KEY: faker.string.uuid(),
    };
    const validated = validate(expected);
    expect(validated).toBe(expected);
  });
});
