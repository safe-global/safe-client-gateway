import { ActivityMetadataSchema } from '@/domain/locking/entities/schemas/activity-metadata.schema';
import { z } from 'zod';

export type ActivityMetadata = z.infer<typeof ActivityMetadataSchema>;
