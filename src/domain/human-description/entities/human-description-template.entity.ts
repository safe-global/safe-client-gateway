import { decodeFunctionData, parseAbi } from 'viem';
import {
  AddressFragment,
  NumberFragment,
  HumanDescriptionFragment,
  TokenValueFragment,
  ValueType,
  TextFragment,
} from './human-description.entity';

type SafeRegExpMatchArray = RegExpMatchArray & {
  groups: NonNullable<RegExpMatchArray['groups']>;
};

function hasGroups(match: RegExpMatchArray): match is SafeRegExpMatchArray {
  return match.groups !== undefined;
}

/**
 * A {@link HumanDescriptionTemplate} represents a human-readable template
 *
 * The template requires a function signature in a string format and the
 * respective human-readable template.
 *
 * Creating a new {@link HumanDescriptionTemplate} triggers the ABI parsing
 * for the function signature, which can be an expensive operation.
 */
export class HumanDescriptionTemplate {
  private readonly functionAbi: never;

  private static readonly REGEX =
    /{{(?<typeToken>\w+) \$(?<paramIndex>\d+)}}|(?<wordToken>\w+)/g;

  /**
   * Store the regex matches as an array instead of an iterable so that it can be restarted
   * @private
   */
  private readonly templateMatches: SafeRegExpMatchArray[];

  constructor(
    functionSignature: string,
    private readonly template: string,
  ) {
    this.functionAbi = parseAbi([functionSignature]);

    this.templateMatches = Array.from(
      template.matchAll(HumanDescriptionTemplate.REGEX),
    )
      .map((match) => {
        if (!match.groups) {
          throw Error(`Error parsing template ${this.template}`);
        }

        return match;
      })
      .filter(hasGroups);
  }

  /**
   * Parses a hex-data string into an array of {@link HumanDescriptionFragment}
   *
   * The resulting array represents the human-readable message in-order i.e.;
   * the first index represents the first word, second index the second word, etc.
   *
   * @param to - the target address of the transaction
   * @param data - the raw data of the transaction
   */
  parse(to: string, data: `0x${string}`): HumanDescriptionFragment[] {
    const { args } = decodeFunctionData({
      abi: this.functionAbi,
      data,
    });

    const fragments: HumanDescriptionFragment[] = [];

    for (const match of this.templateMatches) {
      if ('wordToken' in match.groups && match.groups.wordToken !== undefined) {
        fragments.push(<TextFragment>{
          type: ValueType.Text,
          value: match.groups.wordToken,
        });
      } else if (
        'typeToken' in match.groups &&
        'paramIndex' in match.groups &&
        match.groups.typeToken !== undefined &&
        match.groups.paramIndex !== undefined
      ) {
        const tokenType = match.groups.typeToken;
        const paramIndex = match.groups.paramIndex;

        fragments.push(
          this._mapTokenType(to, tokenType, Number(paramIndex), args),
        );
      } else {
        throw Error(`Error parsing template ${this.template}`);
      }
    }

    return fragments;
  }

  private _mapTokenType(
    to: string,
    tokenType: string,
    index: number,
    args: unknown[],
  ): HumanDescriptionFragment {
    switch (tokenType) {
      case ValueType.TokenValue:
        return <TokenValueFragment>{
          type: ValueType.TokenValue,
          value: { amount: args[index], address: to },
        };
      case ValueType.Address:
        return <AddressFragment>{
          type: ValueType.Address,
          value: args[index],
        };
      case ValueType.Number:
        return <NumberFragment>{
          type: ValueType.Number,
          value: args[index],
        };
      default:
        throw Error(`Unknown token type ${tokenType}`);
    }
  }
}
