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

  it('should detect a malformed configuration in production environment', () => {
    process.env.NODE_ENV = 'production';
    expect(() => validate(JSON.parse(fakeJson()))).toThrow(
      /Mandatory configuration is missing: .*AUTH_TOKEN.*EXCHANGE_API_KEY/,
    );
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
