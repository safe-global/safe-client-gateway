// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

/** Six-digit one-time password produced by an authenticator app. */
export const OtpCodeSchema = z.string().regex(/^\d{6}$/);
