import * as child_process from 'child_process';

/**
 * Returns the build number using the local git client.
 *
 * If git is not available or there is an error, returns null
 */
function getBuildNumber(): null | string {
  try {
    return child_process
      .execSync('git rev-parse --short HEAD')
      .toString()
      .trim();
  } catch (error) {
    return null;
  }
}

export default () => ({
  about: {
    name: 'safe-client-gateway',
    version: process.env.npm_package_version || '',
    buildNumber: getBuildNumber(),
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
  safeConfig: {
    baseUri:
      process.env.SAFE_CONFIG_BASE_URI || 'https://safe-config.safe.global/',
  },
  safeTransaction: {
    useVpcUrl: process.env.USE_TX_SERVICE_VPC_URL?.toLowerCase() === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
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
});
