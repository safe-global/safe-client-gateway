// SPDX-License-Identifier: FSL-1.1-MIT

import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import * as ts from 'typescript';

const repoRoot = path.join(__dirname, '../../../../');
const declaration = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'remote-config.json'), 'utf-8'),
) as { service: string; features: Array<{ key: string }> };
const schema = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'remote-config.schema.json'), 'utf-8'),
) as object;

const declaredKeys = new Set(declaration.features.map((f) => f.key));

/**
 * Walks the TypeScript source tree and collects every string-literal feature
 * key passed as the second argument to an `isFeatureEnabled(...)` call. Keys
 * passed as non-literals (variables) cannot be resolved statically and are
 * reported separately so the test can flag them rather than silently pass.
 */
function calleeName(callee: ts.Expression): string | undefined {
  if (ts.isPropertyAccessExpression(callee)) {
    return callee.name.text;
  }
  if (ts.isIdentifier(callee)) {
    return callee.text;
  }
  return undefined;
}

function collectIsFeatureEnabledKeys(srcDir: string): {
  literals: Set<string>;
  dynamic: Array<string>;
} {
  const literals = new Set<string>();
  const dynamic: Array<string> = [];

  const files = fs
    .readdirSync(srcDir, { recursive: true, encoding: 'utf-8' })
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
    .map((f) => path.join(srcDir, f));

  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf-8'),
      ts.ScriptTarget.Latest,
      true,
    );

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const name = calleeName(node.expression);
        if (name === 'isFeatureEnabled' && node.arguments.length >= 2) {
          const keyArg = node.arguments[1];
          if (
            ts.isStringLiteral(keyArg) ||
            ts.isNoSubstitutionTemplateLiteral(keyArg)
          ) {
            literals.add(keyArg.text);
          } else {
            dynamic.push(
              `${path.relative(repoRoot, file)}:${
                source.getLineAndCharacterOfPosition(keyArg.getStart()).line + 1
              }`,
            );
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return { literals, dynamic };
}

describe('CGW remote-config declaration', () => {
  it('validates against remote-config.schema.json', () => {
    const ajv = new Ajv2020({ allErrors: true });
    const validate = ajv.compile(schema);
    const valid = validate(declaration);
    expect(validate.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });

  it('declares the CGW service', () => {
    expect(declaration.service).toBe('CGW');
  });

  it('has no duplicate feature keys', () => {
    expect(declaredKeys.size).toBe(declaration.features.length);
  });

  it('declares every feature key passed to isFeatureEnabled()', () => {
    const { literals, dynamic } = collectIsFeatureEnabledKeys(
      path.join(repoRoot, 'src'),
    );

    // Non-literal keys cannot be checked statically; surface them so the
    // contract is maintained deliberately rather than silently bypassed.
    expect(dynamic).toEqual([]);

    const undeclared = [...literals].filter((k) => !declaredKeys.has(k));
    expect(undeclared).toEqual([]);
  });
});
