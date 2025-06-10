import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class CheckTokenDto implements z.infer<typeof CheckTokenDtoSchema> {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  spaceId!: string;

  constructor(props: CheckTokenDto) {
    this.accessToken = props.accessToken;
    this.spaceId = props.spaceId;
  }
}

export const CheckTokenDtoSchema = z.object({
  accessToken: z.string(),
  spaceId: z.string(),
});
