// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import semver from 'semver';

export const SemverSchema = z
  .string()
  .refine((value) => semver.parse(value) !== null, {
    error: 'Invalid semver string',
  });
