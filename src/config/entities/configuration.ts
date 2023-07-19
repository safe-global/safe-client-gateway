export default () => ({
  about: {
    name: 'safe-client-gateway',
    version: process.env.APPLICATION_VERSION,
    buildNumber: process.env.APPLICATION_BUILD_NUMBER,
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
    cacheTtlSeconds: parseInt(
      process.env.EXCHANGE_API_CACHE_TTL_SECONDS ?? `${60 * 60 * 12}`,
    ),
  },
  expirationTimeInSeconds: {
    default: parseInt(process.env.EXPIRATION_TIME_DEFAULT_SECONDS ?? `${60}`),
  },
  httpClient: {
    // Timeout in milliseconds to be used for the HTTP client.
    // A value of 0 disables the timeout.
    requestTimeout: parseInt(
      process.env.HTTP_CLIENT_REQUEST_TIMEOUT_MILLISECONDS ?? `${5_000}`,
    ),
  },
  log: {
    level: process.env.LOG_LEVEL || 'debug',
    silent: process.env.LOG_SILENT?.toLowerCase() === 'true',
  },
  notFoundErrorTTLSeconds: {
    contract: parseInt(
      process.env.CONTRACT_NOT_FOUND_ERROR_TTL_SECONDS ?? `${60 * 60}`,
    ),
    token: parseInt(
      process.env.TOKEN_NOT_FOUND_ERROR_TTL_SECONDS ?? `${60 * 60}`,
    ),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
  },
  safeConfig: {
    baseUri:
      process.env.SAFE_CONFIG_BASE_URI || 'https://safe-config.safe.global/',
  },
  safeTransaction: {
    useVpcUrl: process.env.USE_TX_SERVICE_VPC_URL?.toLowerCase() === 'true',
  },
});
