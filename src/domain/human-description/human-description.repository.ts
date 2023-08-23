import { Inject, Injectable } from '@nestjs/common';
import { IHumanDescriptionRepository } from './human-description.repository.interface';
import {
  FunctionSignature,
  HumanDescriptionFragment,
} from './entities/human-description.entity';
import { IHumanDescriptionApi } from '../interfaces/human-description-api.interface';
import { getFunctionSelector } from 'viem';
import { HumanDescriptionTemplate } from './entities/human-description-template.entity';

@Injectable()
export class HumanDescriptionRepository implements IHumanDescriptionRepository {
  private readonly templates: Record<
    FunctionSignature,
    HumanDescriptionTemplate
  > = {};

  constructor(
    @Inject(IHumanDescriptionApi)
    private readonly humanDescriptionApi: IHumanDescriptionApi,
  ) {
    const humanDescriptions = this.humanDescriptionApi.getDescriptions();

    for (const functionSignature in humanDescriptions) {
      const selector = getFunctionSelector(functionSignature);
      this.templates[selector] = new HumanDescriptionTemplate(
        functionSignature,
        humanDescriptions[functionSignature],
      );
    }
  }

  getHumanDescription(args: {
    functionSignature: FunctionSignature;
    to: string;
    data: `0x${string}`;
  }): HumanDescriptionFragment[] {
    const template = this._getTemplate(args.functionSignature);
    return template.parse(args.to, args.data);
  }

  private _getTemplate(
    functionSignature: FunctionSignature,
  ): HumanDescriptionTemplate {
    const template = this.templates[functionSignature];
    if (!template)
      throw Error(`No template for function signature ${functionSignature}`);
    return template;
  }
}
