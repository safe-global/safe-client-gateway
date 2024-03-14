import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SafeAppAccessControl } from '@/routes/safe-apps/entities/safe-app-access-control.entity';
import { SafeAppProvider } from '@/routes/safe-apps/entities/safe-app-provider.entity';
import { SafeAppSocialProfile } from '@/routes/safe-apps/entities/safe-app-social-profile.entity';

export class SafeApp {
  @ApiProperty()
  id: number;
  @ApiProperty()
  url: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  iconUrl: string | null;
  @ApiProperty()
  description: string;
  @ApiProperty()
  chainIds: string[];
  @ApiPropertyOptional({ type: SafeAppProvider, nullable: true })
  provider: SafeAppProvider | null;
  @ApiProperty()
  accessControl: SafeAppAccessControl;
  @ApiProperty()
  tags: string[];
  @ApiProperty()
  features: string[];
  @ApiPropertyOptional({ type: String, nullable: true })
  developerWebsite: string | null;
  @ApiProperty({ type: SafeAppSocialProfile })
  socialProfiles: SafeAppSocialProfile[];

  constructor(
    id: number,
    url: string,
    name: string,
    iconUrl: string | null,
    description: string,
    chainIds: string[],
    provider: SafeAppProvider | null,
    accessControl: SafeAppAccessControl,
    tags: string[],
    features: string[],
    developerWebsite: string | null,
    socialProfiles: SafeAppSocialProfile[],
  ) {
    this.id = id;
    this.url = url;
    this.name = name;
    this.iconUrl = iconUrl;
    this.description = description;
    this.chainIds = chainIds;
    this.provider = provider;
    this.accessControl = accessControl;
    this.tags = tags;
    this.features = features;
    this.developerWebsite = developerWebsite;
    this.socialProfiles = socialProfiles;
  }
}
