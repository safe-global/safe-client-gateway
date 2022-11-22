import { readFileSync } from 'fs';

export default () => {
  let manifestContent;
  try {
    manifestContent = readFileSync('manifest.json', { encoding: 'utf-8' });
  } catch (err) {
    manifestContent = '{}';
  }
  const manifest = JSON.parse(manifestContent);

  return {
    about: {
      name: manifest.name || '',
      version: manifest.version || '',
      buildNumber: process.env.GITHUB_RUN_NUMBER || '',
    },
    exchange: {
      baseUri:
        process.env.EXCHANGE_API_BASE_URI ||
        'http://api.exchangeratesapi.io/v1',
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
  };
};
