import { VerifyAuthMessageDtoSchema } from '@/routes/auth/entities/schemas/verify-auth-message.dto.schema';
import { z } from 'zod';

export type VerifyAuthMessageDto = z.infer<typeof VerifyAuthMessageDtoSchema>;
