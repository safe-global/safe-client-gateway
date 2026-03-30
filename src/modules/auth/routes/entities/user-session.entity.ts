// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UserSession {
  @ApiPropertyOptional()
  id?: string;
}
