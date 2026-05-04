// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SafeAppInfo {
  @ApiProperty()
  id: number;
  @ApiProperty()
  name: string;
  @ApiProperty()
  url: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  logoUri: string | null;

  constructor(id: number, name: string, url: string, logoUri: string | null) {
    this.id = id;
    this.name = name;
    this.url = url;
    this.logoUri = logoUri;
  }
}
