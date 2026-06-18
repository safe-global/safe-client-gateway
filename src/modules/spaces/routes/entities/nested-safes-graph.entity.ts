// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';

export type NodeTrust = 'trusted' | 'suspicious' | 'unknown';

export class NestedSafesGraphNodeDto {
  @ApiProperty()
  public readonly address!: Address;

  @ApiProperty({ type: String, nullable: true })
  public readonly name!: string | null;

  @ApiProperty()
  public readonly isSpaceMember!: boolean;

  @ApiProperty({ enum: ['trusted', 'suspicious', 'unknown'] })
  public readonly trust!: NodeTrust;
}

export class NestedSafesGraphEdgeDto {
  @ApiProperty({ description: 'Owner address (the parent Safe)' })
  public readonly from!: Address;

  @ApiProperty({ description: 'Owned address (the nested Safe)' })
  public readonly to!: Address;
}

export class NestedSafesGraphResponse {
  @ApiProperty()
  public readonly chainId!: string;

  @ApiProperty({ type: NestedSafesGraphNodeDto, isArray: true })
  public readonly nodes!: Array<NestedSafesGraphNodeDto>;

  @ApiProperty({ type: NestedSafesGraphEdgeDto, isArray: true })
  public readonly edges!: Array<NestedSafesGraphEdgeDto>;

  @ApiProperty({ description: 'True when depth/node caps cut the graph' })
  public readonly truncated!: boolean;

  @ApiProperty()
  public readonly depthReached!: number;
}
