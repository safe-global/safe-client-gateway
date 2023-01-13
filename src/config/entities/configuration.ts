export default () => ({
  about: {
    name: 'safe-client-gateway',
    version: process.env.npm_package_version || '',
    buildNumber: process.env.GITHUB_RUN_NUMBER || '',
  },
  applicationPort: process.env.APPLICATION_PORT || '3000',
  exchange: {
    baseUri:
      process.env.EXCHANGE_API_BASE_URI || 'http://api.exchangeratesapi.io/v1',
    apiKey: process.env.EXCHANGE_API_KEY,
  },
  safeConfig: {
    baseUri:
      process.env.SAFE_CONFIG_BASE_URI || 'https://safe-config.gnosis.io',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
  },
  expirationTimeInSeconds: {
    default: process.env.EXPIRATION_TIME_DEFAULT_SECONDS || 60,
  },
});
