// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import configurationValidator from '@/config/configuration.validator';

const schema = z.object({
  signingKey: z.string(),
});

export default registerAs('alerts-route', () => {
  const configuration = { signingKey: process.env.ALERTS_PROVIDER_SIGNING_KEY };
  return configurationValidator(configuration, schema);
});
