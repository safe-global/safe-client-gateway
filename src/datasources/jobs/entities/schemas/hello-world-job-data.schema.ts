import { z } from 'zod';

export const HelloWorldJobDataSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  timestamp: z.number().int().positive('Timestamp must be a positive integer'),
});
