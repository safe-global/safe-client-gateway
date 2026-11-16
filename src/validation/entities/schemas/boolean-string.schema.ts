// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const BooleanStringSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');
