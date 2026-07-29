// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';

export class UrlResponse {
  @ApiProperty()
  url!: string;
}
