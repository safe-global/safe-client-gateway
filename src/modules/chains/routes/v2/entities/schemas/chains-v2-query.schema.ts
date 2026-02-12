import { z } from 'zod';

const serviceKeyErrorMessage = 'serviceKey query parameter is required';

export const ServiceKeyQuerySchema = z
  .string({ error: serviceKeyErrorMessage })
  .min(1, { message: serviceKeyErrorMessage });
