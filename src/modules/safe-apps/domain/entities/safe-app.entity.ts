// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { SafeAppSchema } from '@/modules/safe-apps/domain/entities/schemas/safe-app.schema';

export type SafeApp = z.infer<typeof SafeAppSchema>;
