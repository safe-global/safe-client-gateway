// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { SafeListSchema } from '@/modules/safe/domain/entities/schemas/safe-list.schema';

export type SafeList = z.infer<typeof SafeListSchema>;
