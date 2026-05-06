// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type {
  SafeAppSocialProfilePlatforms,
  SafeAppSocialProfileSchema,
} from '@/modules/safe-apps/domain/entities/schemas/safe-app.schema';

export interface SafeAppSocialProfile
  extends z.infer<typeof SafeAppSocialProfileSchema> {
  platform: SafeAppSocialProfilePlatforms;
  url: string;
}
