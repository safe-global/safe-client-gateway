// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

/**
 * An ISO 4217-shaped currency code, upper-cased so every layer sees one form.
 * Which codes are supported is checked by the route service.
 */
export const FiatCodeSchema = z
  .string()
  .regex(/^[A-Za-z]{3}$/)
  .transform((code) => code.toUpperCase());
