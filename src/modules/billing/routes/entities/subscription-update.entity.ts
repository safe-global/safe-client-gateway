// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type {
  PreviewLineItem as DomainPreviewLineItem,
  SubscriptionUpdatePreview as DomainSubscriptionUpdatePreview,
  UpdateSubscriptionResult as DomainUpdateSubscriptionResult,
} from '@/datasources/billing-api/entities/subscription-update.entity';

export class PreviewLineItem implements DomainPreviewLineItem {
  @ApiProperty()
  description!: string;
  @ApiProperty({
    description:
      'Signed amount in minor units; negative for credit on unused time',
  })
  amount!: number;
  @ApiProperty()
  currency!: string;
}

export class SubscriptionUpdatePreview
  implements DomainSubscriptionUpdatePreview
{
  @ApiProperty()
  amountDue!: number;
  @ApiProperty()
  currency!: string;
  @ApiProperty({ description: 'Unix timestamp in seconds' })
  nextBillingDate!: number;
  @ApiProperty({ type: PreviewLineItem, isArray: true })
  lineItems!: Array<PreviewLineItem>;
}

export class UpdateSubscriptionResult
  implements DomainUpdateSubscriptionResult
{
  @ApiProperty()
  subscriptionId!: string;
  @ApiProperty()
  success!: boolean;
}
