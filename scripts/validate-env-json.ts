// SPDX-License-Identifier: FSL-1.1-MIT
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type EnvVariable,
  findDuplicateNames,
  loadEnvJson,
  PROJECT_ROOT,
  readDirectory,
} from './env-json-helpers';

const SILENT_MODE = process.argv.includes('--silent');
const SRC_PATH = path.join(PROJECT_ROOT, 'src');
const IGNORE_VARIABLES = new Set([
  'CI',
  'NODE_ENV',
  'LOG_SILENT',
  'APPLICATION_VERSION',
  'APPLICATION_BUILD_NUMBER',
]);

const PROCESS_ENV_REGEX = /process\.env\.([A-Z_][A-Z0-9_]*)/g;

const MESSAGES = {
  validating: '🔍 Validating environment variables...\n',
  loading: '📖 Loading .env.sample.json...',
  validStructure: (count: number): string =>
    `✅ Valid JSON structure with ${count} variables\n`,
  checkingDuplicates: '🔎 Checking for duplicates...',
  noDuplicates: '✅ No duplicates found\n',
  extracting: '📖 Extracting variables from src directory...',
  foundInCode: (count: number): string =>
    `Found ${count} process.env.* variables in code\n`,

  duplicatesFound: '❌ Error: Duplicate variables found in .env.sample.json:',
  missingInJson: '❌ Missing variables in .env.sample.json:\n',
  validationFailed:
    '❌ Validation failed: .env.sample.json is missing required variables.\n',
  genericError: (message: string): string => `❌ Error: ${message}`,

  extraInJson:
    '⚠️  Extra variables in .env.sample.json (not found in configuration.ts):\n',
  extraVarsDeprecated: '\n💡 These variables may be outdated or deprecated.\n',
  validationWarning: '⚠️  Validation passed with warnings.\n',

  allDocumented: '✅ All environment variables are properly documented!\n',

  statistics: '📊 Statistics:',
  totalVars: (count: number): string => `   Total variables:      ${count}`,
  required: (count: number): string => `   Required:             ${count}`,
  optional: (count: number): string => `   Optional:             ${count}`,
  withDefaults: (count: number): string => `   With default values:  ${count}`,

  listItem: (name: string): string => `   - ${name}`,
};

/**
 * Log a message to console only if not in silent mode.
 * Use for progress updates, success messages, and statistics.
 *
 * @param message - The message to log
 * @returns void
 */
function log(message: string): void {
  if (!SILENT_MODE) {
    console.info(message);
  }
}

/**
 * Recursively find all TypeScript files in a directory.
 * Excludes node_modules and test files (.spec.ts).
 *
 * @param dir - The directory path to search
 * @returns Array of absolute file paths to TypeScript files
 *
 * Performance note: For large codebases, consider implementing file system caching
 * or using a more efficient traversal approach (e.g., fast-glob package).
 * Currently performs full directory scan on each invocation.
 */
export function findTsFiles(dir: string): Array<string> {
  const files: Array<string> = [];
  const entries = readDirectory(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory && entry.name !== 'node_modules') {
      files.push(...findTsFiles(fullPath));
    } else if (
      entry.isFile &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts')
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract all process.env.* variable references from TypeScript files in src directory.
 * Scans all .ts files (excluding .spec.ts) for process.env.VARIABLE_NAME patterns.
 * Filters out variables in the IGNORE_VARIABLES set.
 *
 * @returns Set of environment variable names found in the codebase
 */
export function extractProcessEnvVariables(): Set<string> {
  const variables = new Set<string>();
  const tsFiles = findTsFiles(SRC_PATH);

  for (const filePath of tsFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Reset regex lastIndex for each file to ensure proper matching
    PROCESS_ENV_REGEX.lastIndex = 0;

    let match: RegExpExecArray | null = PROCESS_ENV_REGEX.exec(content);
    while (match !== null) {
      const varName = match[1];
      if (!IGNORE_VARIABLES.has(varName)) {
        variables.add(varName);
      }
      match = PROCESS_ENV_REGEX.exec(content);
    }
  }

  return variables;
}

/**
 * Check for duplicate variable names.
 * Uses the shared findDuplicateNames helper and reports errors via console.
 */
export function checkDuplicates(envVars: Array<EnvVariable>): boolean {
  const duplicates = findDuplicateNames(envVars);

  if (duplicates.length > 0) {
    console.error(MESSAGES.duplicatesFound);
    for (const name of duplicates) {
      console.error(MESSAGES.listItem(name));
    }
    return false;
  }

  return true;
}

/**
 * Main validation function.
 * Orchestrates the complete validation process:
 * 1. Loads and validates .env.sample.json structure
 * 2. Checks for duplicate variable names
 * 3. Extracts process.env.* references from source code
 * 4. Compares JSON config with actual code usage
 * 5. Reports missing or extra variables
 * 6. Exits with appropriate code (0 = success, 1 = failure)
 *
 * @returns void - Exits process with code 0 (success) or 1 (failure)
 *
 * Behavior in silent mode (--silent flag):
 * - Suppresses progress messages and statistics
 * - Always shows error messages and validation failures
 * - Perfect for CI/CD pipelines
 *
 * Behavior in verbose mode (default):
 * - Shows all progress messages
 * - Shows detailed statistics
 * - Shows warnings for extra variables
 * - Perfect for development and debugging
 */
export function main(): void {
  log(MESSAGES.validating);

  log(MESSAGES.loading);
  const envVars = loadEnvJson();
  log(MESSAGES.validStructure(envVars.length));

  log(MESSAGES.checkingDuplicates);
  if (!checkDuplicates(envVars)) {
    process.exit(1);
  }
  log(MESSAGES.noDuplicates);

  log(MESSAGES.extracting);
  const configVars = extractProcessEnvVariables();
  log(MESSAGES.foundInCode(configVars.size));

  const envVarMap = new Map(envVars.map((v) => [v.name, v]));
  const missingInJson = Array.from(configVars).filter(
    (varName) => !envVarMap.has(varName),
  );

  const extraInJson = envVars
    .filter((v) => !configVars.has(v.name))
    .map((v) => v.name);

  let hasErrors = false;

  if (missingInJson.length > 0) {
    hasErrors = true;
    console.error(MESSAGES.missingInJson);
    for (const name of missingInJson) {
      console.error(MESSAGES.listItem(name));
    }
    console.error('');
  }

  if (extraInJson.length > 0) {
    log(MESSAGES.extraInJson);
    for (const name of extraInJson) {
      log(MESSAGES.listItem(name));
    }
    log(MESSAGES.extraVarsDeprecated);
  }

  const requiredCount = envVars.filter((v) => v.required).length;
  const optionalCount = envVars.filter((v) => !v.required).length;
  const withDefaultsCount = envVars.filter(
    (v) => v.defaultValue !== null,
  ).length;

  log(MESSAGES.statistics);
  log(MESSAGES.totalVars(envVars.length));
  log(MESSAGES.required(requiredCount));
  log(MESSAGES.optional(optionalCount));
  log(MESSAGES.withDefaults(withDefaultsCount));
  log('');

  if (!hasErrors && extraInJson.length === 0) {
    log(MESSAGES.allDocumented);
    process.exit(0);
  }

  if (hasErrors) {
    console.error(MESSAGES.validationFailed);
    process.exit(1);
  }

  log(MESSAGES.validationWarning);
  process.exit(0);
}

if (process.env.NODE_ENV !== 'test') {
  try {
    main();
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(MESSAGES.genericError(error.message));
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }

    console.error(MESSAGES.genericError(String(error)));
    process.exit(1);
  }
}
