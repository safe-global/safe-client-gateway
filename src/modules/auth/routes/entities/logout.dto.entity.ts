// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RedirectUrlSchema } from '@/validation/entities/schemas/redirect-url.schema';
import { z } from 'zod';

export class LogoutDto {
  @ApiPropertyOptional({
    description:
      'Post-logout redirect URL (must be same-origin as pre-configured URL)',
  })
  redirect_url?: string;
}

export const LogoutDtoSchema = z.object({
  redirect_url: RedirectUrlSchema,
});
