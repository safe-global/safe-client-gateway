// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

const FIAT_CODE_LENGTH = 3;

/** An ISO 4217-shaped currency code; which codes are supported is checked upstream. */
export const FiatCodeSchema = z.string().length(FIAT_CODE_LENGTH);
