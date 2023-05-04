import { faker } from '@faker-js/faker';
import { validate } from './configuration.validator';

describe('Configuration validator', () => {
  it('should bypass this validation on tests', () => {
    process.env.NODE_ENV = 'test';
    const expected = JSON.parse(faker.datatype.json());
    const validated = validate(expected);
    expect(validated).toBe(expected);
  });

  it('should detect a malformed configuration in production environment', () => {
    process.env.NODE_ENV = 'production';
    expect(() => validate(JSON.parse(faker.datatype.json()))).toThrow(
      /Mandatory configuration is missing: .*AUTH_TOKEN.*EXCHANGE_API_KEY/,
    );
  });

  it('should return the input configuration if validated in production environment', () => {
    process.env.NODE_ENV = 'production';
    const expected = {
      ...JSON.parse(faker.datatype.json()),
      AUTH_TOKEN: faker.datatype.uuid(),
      EXCHANGE_API_KEY: faker.datatype.uuid(),
    };
    const validated = validate(expected);
    expect(validated).toBe(expected);
  });
});
