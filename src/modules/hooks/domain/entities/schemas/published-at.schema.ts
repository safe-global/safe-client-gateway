// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

/**
 * The `timestamp` property of an AMQP message: when the publisher sent it, in
 * whole seconds since the epoch.
 */
export const PublishedAtSchema = z
  .number()
  .int()
  .positive()
  .transform((seconds) => new Date(seconds * 1000))
  .pipe(z.date());
