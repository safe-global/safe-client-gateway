import { Space } from "@/domain/spaces/entities/space.entity";
import { GetSubscriptionsResultDto, UserSubscription } from "@/routes/pro/billing/billing.types";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class BillingService {

    private readonly logger: Logger = new Logger(BillingService.name);

    constructor(
        @Inject(ConfigService)
        private readonly configService: ConfigService) {
    }
    
    async getSubscriptionsBySpaceId(spaceId: Space['id']): Promise<Array<UserSubscription>> {

        const url = this.configService.get<string>('BILLING_API_URL')
        const token = this.configService.get<string>('BILLING_TOKEN')

        this.logger.debug(`Fetching subscriptions for spaceId: ${spaceId} from ${url}`);

        const response = await fetch(`${url}/api/cgw?spaceId=${spaceId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        });

        if (!response.ok) {
            this.logger.error(`Failed to fetch subscriptions for spaceId: ${spaceId}, status: ${response.status}`);
            return [];
        }

        const result: GetSubscriptionsResultDto = await response.json();

        return result.subscriptions;
  }
}

