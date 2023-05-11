export default () => ({
  about: {
    name: 'safe-client-gateway',
    version: process.env.npm_package_version || '',
    buildNumber: process.env.GITHUB_RUN_NUMBER || '',
  },
  applicationPort: process.env.APPLICATION_PORT || '3000',
  auth: {
    token: process.env.AUTH_TOKEN,
  },
  exchange: {
    baseUri:
      process.env.EXCHANGE_API_BASE_URI ||
      'https://api.apilayer.com/exchangerates_data',
    apiKey: process.env.EXCHANGE_API_KEY,
    cacheTtlSeconds: process.env.EXCHANGE_API_CACHE_TTL_SECONDS,
  },
  safeConfig: {
    baseUri:
      process.env.SAFE_CONFIG_BASE_URI || 'https://safe-config.safe.global/',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
  },
  expirationTimeInSeconds: {
    default: process.env.EXPIRATION_TIME_DEFAULT_SECONDS || 60,
  },
});
