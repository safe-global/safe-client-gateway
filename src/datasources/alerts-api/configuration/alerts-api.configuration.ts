// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
import { registerAs } from '@nestjs/config';
import configurationValidator from '@/config/configuration.validator';
import { z } from 'zod';

const schema = z.object({
  apiKey: z.string(),
  account: z.string(),
  project: z.string(),
});

export default registerAs('alerts-api', () => {
  const configuration = {
    apiKey: process.env.ALERTS_PROVIDER_API_KEY,
    baseUri:
      process.env.ALERTS_PROVIDER_API_BASE_URI || 'https://api.tenderly.co',
    account: process.env.ALERTS_PROVIDER_ACCOUNT,
    project: process.env.ALERTS_PROVIDER_PROJECT,
  };
  return configurationValidator(configuration, schema);
});
