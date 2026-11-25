// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type Address, decodeFunctionData, type Hex } from 'viem';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import type {
  SafeCall,
  SafeCallApprovals,
} from '#/modules/token-approvals/domain/entities/token-approval-call.entity';
import {
  ALLOWANCE_FUNCTION_SELECTORS,
  ALLOWANCE_FUNCTIONS_ABI,
} from '#/modules/token-approvals/domain/token-approvals.constants';

@Injectable()
export class TokenApprovalCallsHelper {
  constructor(
    private readonly multiSendDecoder: MultiSendDecoder,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Finds the allowances a call made by a Safe sets, unpacking delegatecalled
   * MultiSend batches at any nesting depth.
   *
   * A MultiSend reached by a plain call is ignored: its actions run as the
   * MultiSend contract, not as the Safe.
   */
  findApprovals(call: SafeCall): SafeCallApprovals {
    const approvals: SafeCallApprovals = {
      tokenSpenders: [],
      hasOpaqueDelegateCall: false,
    };
    this.collectApprovals(call, approvals);
    return approvals;
  }

  private collectApprovals(call: SafeCall, approvals: SafeCallApprovals): void {
    const data = call.data ?? '0x';

    if (call.operation === Operation.CALL) {
      const spender = this.getSpender(data);
      if (spender) {
        approvals.tokenSpenders.push({ tokenAddress: call.to, spender });
      }
      return;
    }

    const actions = this.multiSendDecoder.helpers.isMultiSend(data)
      ? this.multiSendDecoder.mapMultiSendTransactions(data)
      : [];
    if (actions.length === 0) {
      approvals.hasOpaqueDelegateCall = true;
      return;
    }
    for (const action of actions) {
      this.collectApprovals(action, approvals);
    }
  }

  private getSpender(data: Hex): Address | null {
    const isAllowanceCall = ALLOWANCE_FUNCTION_SELECTORS.some((selector) =>
      data.startsWith(selector),
    );
    if (!isAllowanceCall) {
      return null;
    }
    try {
      const { args } = decodeFunctionData({
        abi: ALLOWANCE_FUNCTIONS_ABI,
        data,
      });
      return args[0];
    } catch (error) {
      // Malformed arguments make the token revert, so no allowance was set.
      this.loggingService.debug(
        `Error decoding allowance call: ${asError(error).message}`,
      );
      return null;
    }
  }
}
