import { ApiProperty } from '@nestjs/swagger';
import { Theme as DomainTheme } from '@/modules/chains/domain/entities/theme.entity';

export class Theme implements DomainTheme {
  @ApiProperty()
  backgroundColor!: string;
  @ApiProperty()
  textColor!: string;
}
