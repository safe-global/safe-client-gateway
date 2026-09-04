// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';
import { CloudCosignerPolicyDto } from '@/modules/cloud-cosigner/routes/entities/cloud-cosigner-policy.dto.entity';

export class CloudCosignerInfoDto {
  @ApiProperty({
    type: String,
    description: 'Address to add as a Safe owner to enable the cloud cosigner',
  })
  public readonly address!: Address;

  @ApiProperty({ type: CloudCosignerPolicyDto })
  public readonly defaultPolicy!: CloudCosignerPolicyDto;
}

export class SafeCloudCosignerStatusDto {
  @ApiProperty({ type: String })
  public readonly cosignerAddress!: Address;

  @ApiProperty({
    type: Boolean,
    description: 'Whether the cosigner is currently an owner of the Safe',
  })
  public readonly isEnabled!: boolean;

  @ApiProperty({ type: CloudCosignerPolicyDto })
  public readonly policy!: CloudCosignerPolicyDto;

  @ApiProperty({
    type: Boolean,
    description: 'True when no policy is stored and the defaults apply',
  })
  public readonly isDefaultPolicy!: boolean;
}
