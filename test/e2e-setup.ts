process.env.SAFE_CONFIG_BASE_URI = 'https://safe-config.staging.5afe.dev';
process.env.EXPIRATION_TIME_DEFAULT_SECONDS = `${60}`; // long enough timeout for cache state assertions
process.env.FF_HUMAN_DESCRIPTION = 'true';
process.env.ALERTS_PROVIDER_SIGNING_KEY = 'fake-signing-key';
process.env.ALERTS_PROVIDER_API_KEY = 'fake-api-key';
process.env.ALERTS_PROVIDER_ACCOUNT = 'fake-account';
process.env.ALERTS_PROVIDER_PROJECT = 'fake-project';
