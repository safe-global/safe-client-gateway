import { ApiProperty } from '@nestjs/swagger';
import { SafeAppSocialProfile as DomainSafeAppSocialProfile } from '@/modules/safe-apps/domain/entities/safe-app-social-profile.entity';
import { SafeAppSocialProfilePlatforms } from '@/modules/safe-apps/domain/entities/schemas/safe-app.schema';

export class SafeAppSocialProfile implements DomainSafeAppSocialProfile {
  @ApiProperty({ enum: SafeAppSocialProfilePlatforms })
  platform!: SafeAppSocialProfilePlatforms;
  @ApiProperty()
  url!: string;
}
