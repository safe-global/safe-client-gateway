export default () => ({
  exchange: {
    baseUri:
      process.env.EXCHANGE_API_BASE_URI ||
      'http://api.exchangeratesapi.io/latest',
    apiKey: process.env.EXCHANGE_API_KEY,
  },
  safeConfig: {
    baseUri:
      process.env.SAFE_CONFIG_BASE_URI || 'https://safe-config.gnosis.io',
  },
});
