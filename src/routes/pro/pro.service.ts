import { AuthPayload } from "@/domain/auth/entities/auth-payload.entity";
import { Space } from "@/domain/spaces/entities/space.entity";
import { BillingService } from "@/routes/pro/billing/billing.service";
import { UserSubscription } from "@/routes/pro/billing/billing.types";
import { CanAccessFeatureDto } from "@/routes/spaces/entities/pro.dto.entity";
import { MembersService } from "@/routes/spaces/members.service";
import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class ProService {

    private readonly logger: Logger = new Logger(ProService.name);
    constructor(private billingService: BillingService, private memberService: MembersService) {
    }
    
    async canAccessProFeatures(authPayload: AuthPayload, spaceId: Space['id'], feature: string): Promise<CanAccessFeatureDto> {

    const result: CanAccessFeatureDto = {
        canAccess: false,
    };

    const member = (await this.memberService.get({authPayload, spaceId})).members.at(0);

    // Member not part of Safe
    if(!member){
        return result;  
    }

    const subscriptions: Array<UserSubscription>  = await this.billingService.getSubscriptionsBySpaceId(spaceId)

    for(const subscription of subscriptions){
        if(subscription.plan.features.includes(feature)){
            result.canAccess = true
            return result;
        }
    }

    return result;
  }
}

