import { ApiProperty } from '@nestjs/swagger';

export class DeleteRecoveryModuleDto {
  @ApiProperty()
  moduleAddress!: string;
}
