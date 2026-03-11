import { Auth0DtoSchema } from '@/modules/auth/routes/entities/auth0.dto.entity';
import { SiweDtoSchema } from '@/modules/auth/routes/entities/siwe.dto.entity';
import { z } from 'zod';

export type VerifyAuthRequest = z.infer<typeof VerifyAuthRequestSchema>;

export const VerifyAuthRequestSchema = z.union([SiweDtoSchema, Auth0DtoSchema]);
