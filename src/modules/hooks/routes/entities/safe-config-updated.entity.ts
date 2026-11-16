// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { SafeConfigUpdatedEventSchema } from '#/modules/hooks/routes/entities/schemas/safe-config-updated.schema';

export type SafeConfigUpdated = z.infer<typeof SafeConfigUpdatedEventSchema>;
