import { Inject, Injectable } from '@nestjs/common';
import { toFunctionSelector } from 'viem';
import { HumanDescriptionTemplate } from '@/modules/human-description/domain/entities/human-description-template.entity';
import {
  type FunctionSignatureHash,
  type HumanDescriptionFragment,
} from '@/modules/human-description/domain/entities/human-description.entity';
import { IHumanDescriptionRepository } from '@/modules/human-description/domain/human-description.repository.interface';
import { IHumanDescriptionApi } from '@/domain/interfaces/human-description-api.interface';
import type { Address } from 'viem';

@Injectable()
export class HumanDescriptionRepository implements IHumanDescriptionRepository {
  private readonly templates: Record<
    FunctionSignatureHash,
    HumanDescriptionTemplate
  > = {};

  constructor(
    @Inject(IHumanDescriptionApi)
    private readonly humanDescriptionApi: IHumanDescriptionApi,
  ) {
    const humanDescriptions = this.humanDescriptionApi.getDescriptions();

    for (const functionSignature in humanDescriptions) {
      const selector = toFunctionSelector(functionSignature);
      this.templates[selector] = new HumanDescriptionTemplate(
        functionSignature,
        humanDescriptions[functionSignature],
      );
    }
  }

  getHumanDescription(args: {
    functionSignatureHash: FunctionSignatureHash;
    to: string;
    data: Address;
  }): Array<HumanDescriptionFragment> {
    const template = this._getTemplate(args.functionSignatureHash);
    return template.parse(args.to, args.data);
  }

  private _getTemplate(
    functionSignature: FunctionSignatureHash,
  ): HumanDescriptionTemplate {
    const template = this.templates[functionSignature];
    if (!template)
      throw Error(`No template for function signature ${functionSignature}`);
    return template;
  }
}
