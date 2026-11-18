// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

/**
 * A consumed AMQP message whose `timestamp` property says when the publisher
 * sent it, in whole seconds since the epoch.
 */
export const PublishedMessageSchema = z.object({
  properties: z.object({
    timestamp: z
      .number()
      .int()
      .positive()
      .transform((seconds) => new Date(seconds * 1000))
      .pipe(z.date()),
  }),
});
