import * as fs from 'fs';
import * as path from 'path';
import {
  PROJECT_ROOT,
  loadEnvJson,
  type EnvVariable,
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

/**
 * Log a message to console only if not in silent mode.
 * Use for progress updates, success messages, and statistics.
 *
 * @param message - The message to log
 * @returns void
 *
 * @example
 * log('✅ Validation passed');
 * // Output (verbose): "✅ Validation passed"
 * // Output (silent): [no output]
 */
function log(message: string): void {
  if (!SILENT_MODE) {
    console.log(message);
  }
}

/**
 * Recursively find all TypeScript files in a directory.
 * Excludes node_modules and test files (.spec.ts).
 *
 * @param dir - The directory path to search
 *
 * @returns Array of absolute file paths to TypeScript files
 */
function findTsFiles(dir: string): Array<string> {
  const files: Array<string> = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && entry.name !== 'node_modules') {
      files.push(...findTsFiles(fullPath));
    } else if (
      entry.isFile() &&
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
function extractProcessEnvVariables(): Set<string> {
  const variables = new Set<string>();
  const regex = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
  const tsFiles = findTsFiles(SRC_PATH);

  for (const filePath of tsFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    let match;

    while ((match = regex.exec(content)) !== null) {
      const varName = match[1];
      if (!IGNORE_VARIABLES.has(varName)) {
        variables.add(varName);
      }
    }
  }

  return variables;
}

/**
 * Check for duplicate variable names
 */
function checkDuplicates(envVars: Array<EnvVariable>): boolean {
  const seen = new Set<string>();
  const duplicates: Array<string> = [];

  for (const envVar of envVars) {
    if (seen.has(envVar.name)) {
      duplicates.push(envVar.name);
    }
    seen.add(envVar.name);
  }

  if (duplicates.length > 0) {
    console.error('❌ Error: Duplicate variables found in .env.sample.json:');
    duplicates.forEach((name) => console.error(`   - ${name}`));
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
function main(): void {
  log('🔍 Validating environment variables...\n');

  log('📖 Loading .env.sample.json...');
  const envVars = loadEnvJson();
  log(`✅ Valid JSON structure with ${envVars.length} variables\n`);

  log('🔎 Checking for duplicates...');
  if (!checkDuplicates(envVars)) {
    process.exit(1);
  }
  log('✅ No duplicates found\n');

  log('📖 Extracting variables from src directory...');
  const configVars = extractProcessEnvVariables();
  log(`Found ${configVars.size} process.env.* variables in code\n`);

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
    console.error('❌ Missing variables in .env.sample.json:\n');
    missingInJson.forEach((name) => {
      console.error(`   - ${name}`);
    });
    console.error('');
  }

  if (extraInJson.length > 0) {
    log(
      '⚠️  Extra variables in .env.sample.json (not found in configuration.ts):\n',
    );
    extraInJson.forEach((name) => {
      log(`   - ${name}`);
    });
    log('\n💡 These variables may be outdated or deprecated.\n');
  }

  const requiredCount = envVars.filter((v) => v.required).length;
  const optionalCount = envVars.filter((v) => !v.required).length;
  const withDefaultsCount = envVars.filter(
    (v) => v.defaultValue !== null,
  ).length;

  log('📊 Statistics:');
  log(`   Total variables:      ${envVars.length}`);
  log(`   Required:             ${requiredCount}`);
  log(`   Optional:             ${optionalCount}`);
  log(`   With default values:  ${withDefaultsCount}`);
  log('');

  if (!hasErrors && extraInJson.length === 0) {
    log('✅ All environment variables are properly documented!\n');
    process.exit(0);
  }

  if (hasErrors) {
    console.error(
      '❌ Validation failed: .env.sample.json is missing required variables.\n',
    );
    process.exit(1);
  }

  log('⚠️  Validation passed with warnings.\n');
  process.exit(0);
}

try {
  main();
} catch (error: unknown) {
  if (error instanceof Error) {
    console.error('❌ Error: ' + error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }

  console.error('❌ Error: ' + String(error));
  process.exit(1);
}
