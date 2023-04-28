import { faker } from '@faker-js/faker';
import { validate } from './configuration.validator';

describe('Configuration validator', () => {
  const { NODE_ENV } = process.env;

  afterAll(() => {
    process.env.NODE_ENV = NODE_ENV;
  });

  it('should bypass this validation on tests', () => {
    process.env.NODE_ENV = 'test';
    const expected = JSON.parse(faker.datatype.json());
    const validated = validate(expected);
    expect(validated).toBe(expected);
  });

  it('should detect a malformed configuration in production environment', () => {
    process.env.NODE_ENV = 'production';
    expect(() => validate(JSON.parse(faker.datatype.json()))).toThrow();
  });

  it('should return the input configuration if validated in production environment', () => {
    process.env.NODE_ENV = 'production';
    const expected = {
      ...JSON.parse(faker.datatype.json()),
      AUTH_TOKEN: 'foo',
      EXCHANGE_API_KEY: 'bar',
    };
    const validated = validate(expected);
    expect(validated).toBe(expected);
  });
});
