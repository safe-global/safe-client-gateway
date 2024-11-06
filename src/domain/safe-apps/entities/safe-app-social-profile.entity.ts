import type { z } from 'zod';
import type {
  SafeAppSocialProfilePlatforms,
  SafeAppSocialProfileSchema,
} from '@/domain/safe-apps/entities/schemas/safe-app.schema';

export interface SafeAppSocialProfile
  extends z.infer<typeof SafeAppSocialProfileSchema> {
  platform: SafeAppSocialProfilePlatforms;
  url: string;
}
