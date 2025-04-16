process.env.SAFE_CONFIG_BASE_URI = 'https://safe-config.staging.5afe.dev';
process.env.EXPIRATION_TIME_DEFAULT_SECONDS = `${60}`; // long enough timeout for cache state assertions
process.env.ALERTS_PROVIDER_SIGNING_KEY = 'fake-signing-key';
process.env.ALERTS_PROVIDER_API_KEY = 'fake-api-key';
process.env.ALERTS_PROVIDER_ACCOUNT = 'fake-account';
process.env.ALERTS_PROVIDER_PROJECT = 'fake-project';
process.env.EMAIL_API_APPLICATION_CODE = 'fake-application-code';
process.env.EMAIL_API_FROM_EMAIL = 'changeme@example.com';
process.env.EMAIL_API_KEY = 'fake-api-key';
process.env.FINGERPRINT_ENCRYPTION_KEY = 'fake-encryption-key';
process.env.INFURA_API_KEY = 'fake-api-key';

// For E2E tests, connect to the test database
process.env.POSTGRES_HOST = 'localhost';
process.env.POSTGRES_PORT = '5433';
process.env.POSTGRES_DB = 'test-db';
process.env.POSTGRES_USER = 'postgres';
process.env.POSTGRES_PASSWORD = 'postgres';
process.env.POSTGRES_SSL_ENABLED = 'true';
process.env.POSTGRES_SSL_CA_PATH = 'db_config/test/server.crt';

// For E2E tests, connect to the test cache
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '6379';

// For E2E tests, connect to the test AMQP server
process.env.AMQP_URL = 'amqp://localhost:5672';
process.env.AMQP_EXCHANGE_NAME = 'test-exchange';
process.env.AMQP_EXCHANGE_MODE = 'fanout';
process.env.AMQP_QUEUE = 'test-queue';
process.env.AMQP_PREFETCH = '100';

process.env.OWNERS_TTL_SECONDS = '0';

// For E2E tests, JWT dummy values
process.env.JWT_ISSUER = 'fase-issuer';
process.env.JWT_SECRET = 'fake-secret';

// For E2E tests, Push notification dummy values
process.env.PUSH_NOTIFICATIONS_API_BASE_URI = 'http://www.fake.com';
process.env.PUSH_NOTIFICATIONS_API_PROJECT = 'fake-project';
process.env.PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_CLIENT_EMAIL =
  'email@fake-email.com';
process.env.PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_PRIVATE_KEY =
  'fake-private-key';
