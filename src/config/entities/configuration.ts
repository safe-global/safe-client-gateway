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
  chains: {
    knownImplementations: [
      { chainId: '1', implementationName: 'ethereum' },
      { chainId: '42161', implementationName: 'arbitrum' },
      { chainId: '1313161554', implementationName: 'aurora' },
      { chainId: '43114', implementationName: 'avalanche' },
      { chainId: '8453', implementationName: 'base' },
      { chainId: '56', implementationName: 'binance-smart-chain' },
      { chainId: '10', implementationName: 'optimism' },
      { chainId: '137', implementationName: 'polygon' },
      { chainId: '100', implementationName: 'xdai' },
      { chainId: '324', implementationName: 'zksync-era' },
    ],
  },
  expirationTimeInSeconds: {
    default: parseInt(process.env.EXPIRATION_TIME_DEFAULT_SECONDS ?? `${60}`),
    notFound: {
      default: parseInt(
        process.env.DEFAULT_NOT_FOUND_EXPIRE_TIME_SECONDS ?? `${30}`,
      ),
      contract: parseInt(
        process.env.CONTRACT_NOT_FOUND_EXPIRE_TIME_SECONDS ?? `${60}`,
      ),
      token: parseInt(
        process.env.TOKEN_NOT_FOUND_EXPIRE_TIME_SECONDS ?? `${60}`,
      ),
    },
  },
  features: {
    humanDescription:
      process.env.FF_HUMAN_DESCRIPTION?.toLowerCase() === 'true',
    messagesCache: process.env.FF_MESSAGES_CACHE?.toLowerCase() === 'true',
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
  portfoliosProvider: {
    apiKey: process.env.PORTFOLIOS_PROVIDER_API_KEY,
    baseUri:
      process.env.PORTFOLIOS_PROVIDER_API_BASE_URI ||
      'https://api.zerion.io/v1',
    currencies: [
      'usd',
      'eur',
      'eth',
      'aud',
      'btc',
      'cad',
      'chf',
      'cny',
      'gbp',
      'inr',
      'jpy',
      'krw',
      'nzd',
      'rub',
      'try',
      'zar',
    ],
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
  },
  relay: {
    limit: parseInt(process.env.RELAY_THROTTLE_LIMIT ?? `${5}`),
  },
  safeConfig: {
    baseUri:
      process.env.SAFE_CONFIG_BASE_URI || 'https://safe-config.safe.global/',
  },
  safeTransaction: {
    useVpcUrl: process.env.USE_TX_SERVICE_VPC_URL?.toLowerCase() === 'true',
  },
});
