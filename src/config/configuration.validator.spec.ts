import { faker } from '@faker-js/faker';
import { fakeJson } from '@/__tests__/faker';
import { omit } from 'lodash';
import configurationValidator from '@/config/configuration.validator';
import { RootConfigurationSchema } from '@/config/configuration.module';

describe('Configuration validator', () => {
  const validConfiguration: Record<string, unknown> = {
    ...JSON.parse(fakeJson()),
    AUTH_TOKEN: faker.string.uuid(),
    ALERTS_PROVIDER_SIGNING_KEY: faker.string.uuid(),
    ALERTS_PROVIDER_API_KEY: faker.string.uuid(),
    ALERTS_PROVIDER_ACCOUNT: faker.string.alphanumeric(),
    ALERTS_PROVIDER_PROJECT: faker.string.alphanumeric(),
    EMAIL_API_APPLICATION_CODE: faker.string.alphanumeric(),
    EMAIL_API_FROM_EMAIL: faker.internet.email(),
    EMAIL_API_KEY: faker.string.uuid(),
    EMAIL_TEMPLATE_RECOVERY_TX: faker.string.alphanumeric(),
    EMAIL_TEMPLATE_UNKNOWN_RECOVERY_TX: faker.string.alphanumeric(),
    EMAIL_TEMPLATE_VERIFICATION_CODE: faker.string.alphanumeric(),
    INFURA_API_KEY: faker.string.uuid(),
    RELAY_PROVIDER_API_KEY_ARBITRUM_ONE: faker.string.uuid(),
    RELAY_PROVIDER_API_KEY_GNOSIS_CHAIN: faker.string.uuid(),
    RELAY_PROVIDER_API_KEY_SEPOLIA: faker.string.uuid(),
  };

  it('should bypass this validation on test environment', () => {
    process.env.NODE_ENV = 'test';
    const expected: Record<string, unknown> = JSON.parse(fakeJson());
    const validated = configurationValidator(expected, RootConfigurationSchema);
    expect(validated).toBe(expected);
  });

  it('should return the input configuration if validated in production environment', () => {
    process.env.NODE_ENV = 'production';
    const validated = configurationValidator(
      validConfiguration,
      RootConfigurationSchema,
    );
    expect(validated).toBe(validConfiguration);
  });

  it.each([
    { key: 'AUTH_TOKEN' },
    { key: 'EMAIL_API_APPLICATION_CODE' },
    { key: 'EMAIL_API_FROM_EMAIL' },
    { key: 'EMAIL_API_KEY' },
    { key: 'EMAIL_TEMPLATE_RECOVERY_TX' },
    { key: 'EMAIL_TEMPLATE_UNKNOWN_RECOVERY_TX' },
    { key: 'EMAIL_TEMPLATE_VERIFICATION_CODE' },
    { key: 'INFURA_API_KEY' },
    { key: 'RELAY_PROVIDER_API_KEY_ARBITRUM_ONE' },
    { key: 'RELAY_PROVIDER_API_KEY_GNOSIS_CHAIN' },
    { key: 'RELAY_PROVIDER_API_KEY_SEPOLIA' },
  ])(
    'should detect that $key is missing in the configuration in production environment',
    ({ key }) => {
      process.env.NODE_ENV = 'production';
      expect(() =>
        configurationValidator(
          omit(validConfiguration, key),
          RootConfigurationSchema,
        ),
      ).toThrow(`Configuration is invalid: ${key} Required`);
    },
  );

  it('should an invalid LOG_LEVEL configuration in production environment', () => {
    process.env.NODE_ENV = 'production';
    const invalidConfiguration: Record<string, unknown> = {
      ...JSON.parse(fakeJson()),
      AUTH_TOKEN: faker.string.uuid(),
      LOG_LEVEL: faker.word.words(),
      ALERTS_PROVIDER_SIGNING_KEY: faker.string.uuid(),
      ALERTS_PROVIDER_API_KEY: faker.string.uuid(),
      ALERTS_PROVIDER_ACCOUNT: faker.string.alphanumeric(),
      ALERTS_PROVIDER_PROJECT: faker.string.alphanumeric(),
      EMAIL_API_APPLICATION_CODE: faker.string.alphanumeric(),
      EMAIL_API_FROM_EMAIL: faker.internet.email(),
      EMAIL_API_KEY: faker.string.uuid(),
      EMAIL_TEMPLATE_RECOVERY_TX: faker.string.alphanumeric(),
      EMAIL_TEMPLATE_UNKNOWN_RECOVERY_TX: faker.string.alphanumeric(),
      EMAIL_TEMPLATE_VERIFICATION_CODE: faker.string.alphanumeric(),
      INFURA_API_KEY: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_ARBITRUM_ONE: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_GNOSIS_CHAIN: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_SEPOLIA: faker.string.uuid(),
    };
    expect(() =>
      configurationValidator(invalidConfiguration, RootConfigurationSchema),
    ).toThrow(
      /LOG_LEVEL Invalid enum value. Expected 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly', received/,
    );
  });
});
