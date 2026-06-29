// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const TotpVerifyDtoSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export class TotpVerifyDto implements z.infer<typeof TotpVerifyDtoSchema> {
  @ApiProperty({ example: '123456' })
  code!: string;

  constructor(props: TotpVerifyDto) {
    this.code = props.code;
  }
}
