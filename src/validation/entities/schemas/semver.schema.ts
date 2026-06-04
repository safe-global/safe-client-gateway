// SPDX-License-Identifier: FSL-1.1-MIT

import semver from 'semver';
import { z } from 'zod';

export const SemverSchema = z
  .string()
  .refine((value) => semver.parse(value) !== null, {
    error: 'Invalid semver string',
  });
