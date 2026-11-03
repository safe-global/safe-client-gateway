// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

/** An ISO 4217-shaped currency code; which codes are supported is checked upstream. */
export const FiatCodeSchema = z.string().regex(/^[A-Za-z]{3}$/);
