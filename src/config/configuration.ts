export default () => ({
  exchange: {
    baseUri:
      process.env.EXCHANGE_API_BASE_URI ||
      'http://api.exchangeratesapi.io/latest',
    apiKey: process.env.EXCHANGE_API_KEY,
  },
});
