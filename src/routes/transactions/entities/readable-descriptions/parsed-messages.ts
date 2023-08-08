import * as Messages from './index';
import {
  ContractMessages,
  HumanReadableFragment,
  ValueType,
} from 'src/routes/transactions/mappers/common/readable-descriptions.mapper';

type Expression = {
  [key: string]: string;
};

// TODO: Write tests for this parser
/**
 * Go from a template string like this
 * Send {{tokenValue 1}} to {{recipient 0}}
 * to an array of HumanReadableFragment objects
 * @param messages
 */
function parseMessages(messages: Expression): ContractMessages {
  const contractMessages: ContractMessages = {};

  for (const callSignature in messages) {
    const template = messages[callSignature];

    contractMessages[callSignature] = {
      render: (to: string, params: unknown[]) => {
        const fragments: HumanReadableFragment[] = [];

        /** This matches 2 patterns:
         *  1. Match double curly braces consisting of 2 groups separated by a space
         *  2. Match any non-whitespace character i.e. simple words
         */
        const regex = /{{(.*?)\s(.*?)}}|(\S+)/g;

        let match: RegExpExecArray | null;

        while ((match = regex.exec(template)) !== null) {
          const [fullMatch, valueType, valueIndex] = match;

          // Just a simple string
          if (fullMatch && !valueType && !valueIndex) {
            fragments.push({
              type: ValueType.Word,
              value: fullMatch,
            });
            continue;
          }

          const parsedExpression = parseExpression(
            valueType as ValueType,
            Number(valueIndex),
            to,
            params,
          );

          fragments.push(parsedExpression);
        }

        return fragments;
      },
    };
  }

  return contractMessages;
}

function parseExpression(
  valueType: ValueType,
  valueIndex: number,
  to: string,
  params: unknown[],
): HumanReadableFragment {
  const parsedParams = parseParams(valueType, valueIndex, to, params);

  return <HumanReadableFragment>{
    type: valueType,
    value: parsedParams,
  };
}

function parseParams(
  valueType: ValueType,
  valueIndex: number,
  to: string,
  params: unknown[],
) {
  switch (valueType) {
    case ValueType.TokenValue:
      const amount = params[valueIndex];
      const address = to;

      return {
        amount,
        address,
      };
    case ValueType.Recipient:
      return params[valueIndex];
    default:
      return to;
  }
}

export const MessagesParsed = parseMessages(Messages.default);
