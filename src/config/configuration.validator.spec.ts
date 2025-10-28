import { fakeJson } from '@/__tests__/faker';
import configurationValidator from '@/config/configuration.validator';
import { RootConfigurationSchema } from '@/config/entities/schemas/configuration.schema';
import { faker } from '@faker-js/faker';
import omit from 'lodash/omit';

describe('Configuration validator', () => {
  const validConfiguration: Record<string, unknown> = {
    ...JSON.parse(fakeJson()),
    AUTH_TOKEN: faker.string.uuid(),
    AWS_ACCESS_KEY_ID: faker.string.uuid(),
    AWS_KMS_ENCRYPTION_KEY_ID: faker.string.uuid(),
    AWS_SECRET_ACCESS_KEY: faker.string.uuid(),
    AWS_REGION: faker.string.alphanumeric(),
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
    EXPIRATION_DEVIATE_PERCENT: faker.number.int({ min: 0, max: 100 }),
    FINGERPRINT_ENCRYPTION_KEY: faker.string.uuid(),
    INFURA_API_KEY: faker.string.uuid(),
    JWT_ISSUER: faker.string.uuid(),
    JWT_SECRET: faker.string.uuid(),
    PUSH_NOTIFICATIONS_API_PROJECT: faker.word.noun(),
    PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_CLIENT_EMAIL: faker.internet.email(),
    PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_PRIVATE_KEY:
      faker.string.alphanumeric(),
    RELAY_PROVIDER_API_KEY_OPTIMISM: faker.string.uuid(),
    RELAY_PROVIDER_API_KEY_BSC: faker.string.uuid(),
    RELAY_PROVIDER_API_KEY_GNOSIS_CHAIN: faker.string.uuid(),
    RELAY_PROVIDER_API_KEY_POLYGON: faker.string.uuid(),
    RELAY_PROVIDER_API_KEY_POLYGON_ZKEVM: faker.string.uuid(),
    RELAY_PROVIDER_API_KEY_BASE: faker.string.uuid(),
    RELAY_PROVIDER_API_KEY_ARBITRUM_ONE: faker.string.uuid(),
    RELAY_PROVIDER_API_KEY_AVALANCHE: faker.string.uuid(),
    RELAY_PROVIDER_API_KEY_LINEA: faker.string.uuid(),
    RELAY_PROVIDER_API_KEY_BLAST: faker.string.uuid(),
    RELAY_PROVIDER_API_KEY_SEPOLIA: faker.string.uuid(),
    RELAY_NO_FEE_CAMPAIGN_SEPOLIA_SAFE_TOKEN_ADDRESS:
      faker.finance.ethereumAddress(),
    RELAY_NO_FEE_CAMPAIGN_SEPOLIA_START_TIMESTAMP: faker.date.past().getTime(),
    RELAY_NO_FEE_CAMPAIGN_SEPOLIA_END_TIMESTAMP: faker.date.future().getTime(),
    RELAY_NO_FEE_CAMPAIGN_SEPOLIA_MAX_GAS_LIMIT: faker.number.int({
      min: 1,
      max: 1000,
    }),
    RELAY_NO_FEE_CAMPAIGN_SEPOLIA_RELAY_RULES: JSON.stringify([
      { balance: 0, limit: 0 },
      { balance: 100, limit: 1 },
      { balance: 1000, limit: 10 },
    ]),
    RELAY_NO_FEE_CAMPAIGN_MAINNET_SAFE_TOKEN_ADDRESS:
      faker.finance.ethereumAddress(),
    RELAY_NO_FEE_CAMPAIGN_MAINNET_START_TIMESTAMP: faker.date.past().getTime(),
    RELAY_NO_FEE_CAMPAIGN_MAINNET_END_TIMESTAMP: faker.date.future().getTime(),
    RELAY_NO_FEE_CAMPAIGN_MAINNET_MAX_GAS_LIMIT: faker.number.int({
      min: 1,
      max: 1000,
    }),
    RELAY_NO_FEE_CAMPAIGN_MAINNET_RELAY_RULES: JSON.stringify([
      { balance: 0, limit: 0 },
      { balance: 100, limit: 1 },
      { balance: 1000, limit: 10 },
    ]),
    STAKING_API_KEY: faker.string.uuid(),
    STAKING_TESTNET_API_KEY: faker.string.uuid(),
    CSV_AWS_ACCESS_KEY_ID: faker.string.uuid(),
    CSV_AWS_SECRET_ACCESS_KEY: faker.string.uuid(),
    CSV_EXPORT_QUEUE_CONCURRENCY: faker.number.int({ min: 1, max: 5 }),
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
    { key: 'FINGERPRINT_ENCRYPTION_KEY' },
    { key: 'INFURA_API_KEY' },
    { key: 'JWT_ISSUER' },
    { key: 'JWT_SECRET' },
    { key: 'PUSH_NOTIFICATIONS_API_PROJECT' },
    { key: 'PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_CLIENT_EMAIL' },
    { key: 'PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_PRIVATE_KEY' },
    { key: 'RELAY_PROVIDER_API_KEY_OPTIMISM' },
    { key: 'RELAY_PROVIDER_API_KEY_BSC' },
    { key: 'RELAY_PROVIDER_API_KEY_GNOSIS_CHAIN' },
    { key: 'RELAY_PROVIDER_API_KEY_POLYGON' },
    { key: 'RELAY_PROVIDER_API_KEY_POLYGON_ZKEVM' },
    { key: 'RELAY_PROVIDER_API_KEY_BASE' },
    { key: 'RELAY_PROVIDER_API_KEY_ARBITRUM_ONE' },
    { key: 'RELAY_PROVIDER_API_KEY_AVALANCHE' },
    { key: 'RELAY_PROVIDER_API_KEY_LINEA' },
    { key: 'RELAY_PROVIDER_API_KEY_BLAST' },
    { key: 'RELAY_PROVIDER_API_KEY_SEPOLIA' },
    { key: 'STAKING_API_KEY' },
    { key: 'STAKING_TESTNET_API_KEY' },
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

  it('should detect an invalid LOG_LEVEL configuration in production environment', () => {
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
      EXPIRATION_DEVIATE_PERCENT: faker.number.int({ min: 0, max: 100 }),
      FINGERPRINT_ENCRYPTION_KEY: faker.string.uuid(),
      INFURA_API_KEY: faker.string.uuid(),
      JWT_ISSUER: faker.string.uuid(),
      JWT_SECRET: faker.string.uuid(),
      PUSH_NOTIFICATIONS_API_PROJECT: faker.word.noun(),
      PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_CLIENT_EMAIL:
        faker.internet.email(),
      PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_PRIVATE_KEY:
        faker.string.alphanumeric(),
      RELAY_PROVIDER_API_KEY_OPTIMISM: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_BSC: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_GNOSIS_CHAIN: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_POLYGON: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_POLYGON_ZKEVM: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_BASE: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_ARBITRUM_ONE: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_AVALANCHE: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_LINEA: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_BLAST: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_SEPOLIA: faker.string.uuid(),
      STAKING_API_KEY: faker.string.uuid(),
      STAKING_TESTNET_API_KEY: faker.string.uuid(),
    };
    expect(() =>
      configurationValidator(invalidConfiguration, RootConfigurationSchema),
    ).toThrow(
      /LOG_LEVEL Invalid enum value. Expected 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly', received/,
    );
  });

  it.each([
    { key: 'TARGETED_MESSAGING_FILE_STORAGE_TYPE' },
    { key: 'CSV_EXPORT_FILE_STORAGE_TYPE' },
  ])(
    `should detect an invalid $key configuration in production environment`,
    ({ key }) => {
      process.env.NODE_ENV = 'production';
      const config = {
        ...omit(validConfiguration, key),
        [`${key}`]: faker.lorem.words(),
      };
      expect(() =>
        configurationValidator(config, RootConfigurationSchema),
      ).toThrow(
        new RegExp(
          `${key} Invalid enum value. Expected 'local' | 'aws', received`,
        ),
      );
    },
  );

  it('should detect an invalid TARGETED_MESSAGING_FILE_STORAGE_TYPE configuration in production environment', () => {
    process.env.NODE_ENV = 'production';
    const invalidConfiguration: Record<string, unknown> = {
      ...JSON.parse(fakeJson()),
      AUTH_TOKEN: faker.string.uuid(),
      AWS_ACCESS_KEY_ID: faker.string.uuid(),
      AWS_KMS_ENCRYPTION_KEY_ID: faker.string.uuid(),
      AWS_SECRET_ACCESS_KEY: faker.string.uuid(),
      AWS_REGION: faker.lorem.word(),
      LOG_LEVEL: faker.helpers.arrayElement(['error', 'warn', 'info']),
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
      EXPIRATION_DEVIATE_PERCENT: faker.number.int({ min: 0, max: 100 }),
      FINGERPRINT_ENCRYPTION_KEY: faker.string.uuid(),
      INFURA_API_KEY: faker.string.uuid(),
      JWT_ISSUER: faker.string.uuid(),
      JWT_SECRET: faker.string.uuid(),
      PUSH_NOTIFICATIONS_API_PROJECT: faker.word.noun(),
      PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_CLIENT_EMAIL:
        faker.internet.email(),
      PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_PRIVATE_KEY:
        faker.string.alphanumeric(),
      RELAY_PROVIDER_API_KEY_OPTIMISM: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_BSC: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_GNOSIS_CHAIN: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_POLYGON: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_POLYGON_ZKEVM: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_BASE: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_ARBITRUM_ONE: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_AVALANCHE: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_LINEA: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_BLAST: faker.string.uuid(),
      RELAY_PROVIDER_API_KEY_SEPOLIA: faker.string.uuid(),
      STAKING_API_KEY: faker.string.uuid(),
      STAKING_TESTNET_API_KEY: faker.string.uuid(),
      TARGETED_MESSAGING_FILE_STORAGE_TYPE: faker.lorem.words(),
    };
    expect(() =>
      configurationValidator(invalidConfiguration, RootConfigurationSchema),
    ).toThrow(
      /TARGETED_MESSAGING_FILE_STORAGE_TYPE Invalid enum value. Expected 'local' | 'aws', received/,
    );
  });

  describe.each(['staging', 'production'])('%s environment', (env) => {
    it.each([
      { key: 'AWS_ACCESS_KEY_ID' },
      { key: 'AWS_KMS_ENCRYPTION_KEY_ID' },
      { key: 'AWS_SECRET_ACCESS_KEY' },
      { key: 'AWS_REGION' },
      { key: 'CSV_AWS_ACCESS_KEY_ID' },
      { key: 'CSV_AWS_SECRET_ACCESS_KEY' },
    ])(`should require $key configuration in ${env} environment`, ({ key }) => {
      process.env.NODE_ENV = 'production';
      const config = { ...omit(validConfiguration, key), CGW_ENV: env };
      expect(() =>
        configurationValidator(config, RootConfigurationSchema),
      ).toThrow(
        `Configuration is invalid: ${key} is required in production and staging environments`,
      );
    });
  });

  describe('RELAY_NO_FEE_CAMPAIGN relay rules validation', () => {
    describe.each([
      'RELAY_NO_FEE_CAMPAIGN_MAINNET_RELAY_RULES',
      'RELAY_NO_FEE_CAMPAIGN_SEPOLIA_RELAY_RULES',
    ])('%s', (fieldKey) => {
      it('should accept valid JSON array of relay rules', () => {
        const config = {
          ...validConfiguration,
          [fieldKey]: JSON.stringify([
            { balance: 0, limit: 0 },
            { balance: 100, limit: 5 },
            { balance: 1000, limit: 50 },
          ]),
        };
        expect(() =>
          configurationValidator(config, RootConfigurationSchema),
        ).not.toThrow();
      });

      it('should reject empty string', () => {
        const config = {
          ...validConfiguration,
          [fieldKey]: '',
        };
        expect(() =>
          configurationValidator(config, RootConfigurationSchema),
        ).toThrow(
          new RegExp(
            `Configuration is invalid: ${fieldKey} Must be a valid JSON array of objects with balance \\(number >= 0\\) and limit \\(number >= 0\\) properties`,
          ),
        );
      });

      it('should reject invalid JSON', () => {
        const config = {
          ...validConfiguration,
          [fieldKey]: 'invalid json',
        };
        expect(() =>
          configurationValidator(config, RootConfigurationSchema),
        ).toThrow(
          new RegExp(
            `Configuration is invalid: ${fieldKey} Must be a valid JSON array of objects with balance \\(number >= 0\\) and limit \\(number >= 0\\) properties`,
          ),
        );
      });

      it('should reject non-array JSON', () => {
        const config = {
          ...validConfiguration,
          [fieldKey]: JSON.stringify({
            balance: 0,
            limit: 0,
          }),
        };
        expect(() =>
          configurationValidator(config, RootConfigurationSchema),
        ).toThrow(
          new RegExp(
            `Configuration is invalid: ${fieldKey} Must be a valid JSON array of objects with balance \\(number >= 0\\) and limit \\(number >= 0\\) properties`,
          ),
        );
      });

      it('should reject array with invalid objects', () => {
        const config = {
          ...validConfiguration,
          [fieldKey]: JSON.stringify([
            { balance: 0, limit: 0 },
            { balance: 'invalid', limit: 5 }, // Invalid balance type
          ]),
        };
        expect(() =>
          configurationValidator(config, RootConfigurationSchema),
        ).toThrow(
          new RegExp(
            `Configuration is invalid: ${fieldKey} Must be a valid JSON array of objects with balance \\(number >= 0\\) and limit \\(number >= 0\\) properties`,
          ),
        );
      });

      it('should reject negative balance values', () => {
        const config = {
          ...validConfiguration,
          [fieldKey]: JSON.stringify([{ balance: -1, limit: 0 }]),
        };
        expect(() =>
          configurationValidator(config, RootConfigurationSchema),
        ).toThrow(
          new RegExp(
            `Configuration is invalid: ${fieldKey} Must be a valid JSON array of objects with balance \\(number >= 0\\) and limit \\(number >= 0\\) properties`,
          ),
        );
      });

      it('should reject negative limit values', () => {
        const config = {
          ...validConfiguration,
          [fieldKey]: JSON.stringify([{ balance: 0, limit: -1 }]),
        };
        expect(() =>
          configurationValidator(config, RootConfigurationSchema),
        ).toThrow(
          new RegExp(
            `Configuration is invalid: ${fieldKey} Must be a valid JSON array of objects with balance \\(number >= 0\\) and limit \\(number >= 0\\) properties`,
          ),
        );
      });
    });
  });
});
