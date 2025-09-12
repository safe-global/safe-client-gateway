import { Injectable } from '@nestjs/common';
import { RecipientAnalysisService } from './recipient-analysis/recipient-analysis.service';
import { ContractAnalysisService } from './contract-analysis/contract-analysis.service';
import { ThreatAnalysisService } from './threat-analysis/threat-analysis.service';

/**
 * Main orchestration service for Safe Shield transaction analysis.
 *
 * This service coordinates all analysis types (recipient, contract, threat)
 * and provides the main entry points for transaction safety checks.
 * It acts as a facade that delegates to specialized analysis services.
 */
@Injectable()
export class SafeShieldService {
  constructor(
    private readonly recipientAnalysisService: RecipientAnalysisService,
    private readonly contractAnalysisService: ContractAnalysisService,
    private readonly threatAnalysisService: ThreatAnalysisService,
  ) {}
}
