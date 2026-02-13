import * as fs from 'fs';
import * as path from 'path';
import {
  PROJECT_ROOT,
  loadEnvJson,
  setFilePermissions,
  isSymbolicLink,
  sanitizeEnvValue,
  formatRequiredVar,
  formatOptionalVar,
} from './env-json-helpers';

const ENV_OUTPUT_PATH = path.join(PROJECT_ROOT, '.env');
const FORCE_MODE = process.argv.includes('--force');
const UPDATE_MODE = process.argv.includes('--update');

/**
 * Centralized messages for generate/update output
 */
const MESSAGES = {
  update: {
    noFileCreating: '🔧 .env file does not exist. Creating new .env file...\n',
    upToDate: '✅ Your .env file is already up to date!',
    success: '✅ Successfully updated .env file!',
    actionRequired: '⚠️  Action required:',
    reviewRequired: '   Review the new required variables at the end of .env',
    updateValues:
      '   Update them with actual values before running the application',
    optionalVarsTitle: '💡 Optional variables:',
    optionalCommented: '   Optional variables are commented out',
    uncommentToOverride:
      '   Uncomment and modify if you want to override defaults',
  },
  generate: {
    fileExists: '❌ Error: .env file already exists',
    success: '✅ Successfully generated .env file!',
  },
  common: {
    nextSteps: '⚠️  Next steps:',
    step1: '   1. Review the generated .env file',
    step2: '   2. Update all required variables with actual values',
    step3: '   3. Uncomment and modify optional variables as needed',
  },
  error: {
    generic: (message: string): string => `❌ Error: ${message}`,
  },
  headers: {
    missingRequired: (timestamp: string): string =>
      `# MISSING REQUIRED VARIABLES - Added by env:update on ${timestamp}`,
    missingOptional: (timestamp: string): string =>
      `# MISSING OPTIONAL VARIABLES - Added by env:update on ${timestamp}`,
    uncommentNote:
      '# Uncomment and modify these variables if you want to override the defaults',
  },
};

const SECTION_SEPARATOR =
  '# ==============================================================================';

/**
 * Guard against writing to a symbolic link.
 * Prevents symlink clobber attacks by exiting if the target path is a symlink.
 */
function assertNotSymlink(): void {
  if (isSymbolicLink(ENV_OUTPUT_PATH)) {
    console.error(
      MESSAGES.error.generic(
        '.env file is a symbolic link. Remove it before generating.',
      ),
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse existing .env file and extract variable names (both active and commented).
 * This detects both uncommented variables (VARIABLE=value) and commented ones (# VARIABLE=value)
 * to prevent duplicate additions when variables already exist as comments.
 *
 * @returns Map of variable names to their current values (commented vars have empty string value)
 */
export function parseExistingEnv(): Map<string, string> {
  const envMap = new Map<string, string>();

  if (!fs.existsSync(ENV_OUTPUT_PATH)) {
    return envMap;
  }

  const content = fs.readFileSync(ENV_OUTPUT_PATH, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.length > 10000) {
      continue;
    }

    const activeVarMatch = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (activeVarMatch) {
      const [, name, value] = activeVarMatch;
      if (/^[A-Z_][A-Z0-9_]*$/.test(name)) {
        const safeValue = sanitizeEnvValue(value);
        envMap.set(String(name), safeValue);
      }
      continue;
    }

    const commentedVarMatch = trimmed.match(/^#\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (commentedVarMatch) {
      const [, name] = commentedVarMatch;
      if (/^[A-Z_][A-Z0-9_]*$/.test(name) && !envMap.has(name)) {
        envMap.set(String(name), '');
      }
    }
  }

  return envMap;
}

/**
 * Generate or update .env file with variables from .env.sample.json.
 * - If .env doesn't exist: creates it with all required variables
 * - If .env exists: appends only missing variables (preserves all existing values)
 * Optional variables with defaults are added as comments.
 *
 * @returns void - Exits process with code 0 on success, 1 on failure
 */
export function updateEnvFile(): void {
  const envExists = fs.existsSync(ENV_OUTPUT_PATH);

  if (!envExists) {
    console.log(MESSAGES.update.noFileCreating);
    generateNewEnvFile();

    return;
  }

  const existingVars = parseExistingEnv();
  const envVars = loadEnvJson();

  const missingRequired = envVars.filter(
    (v) => v.required && !existingVars.has(v.name),
  );
  const missingOptional = envVars.filter(
    (v) => !v.required && !existingVars.has(v.name) && v.defaultValue !== null,
  );

  if (missingRequired.length === 0 && missingOptional.length === 0) {
    console.log(MESSAGES.update.upToDate);
    process.exit(0);
  }

  const linesToAdd: Array<string> = [];

  if (missingRequired.length > 0) {
    linesToAdd.push('');
    linesToAdd.push(SECTION_SEPARATOR);
    linesToAdd.push(MESSAGES.headers.missingRequired(new Date().toISOString()));
    linesToAdd.push(SECTION_SEPARATOR);
    linesToAdd.push('');

    for (const envVar of missingRequired) {
      linesToAdd.push(...formatRequiredVar(envVar));
    }
  }

  if (missingOptional.length > 0) {
    linesToAdd.push('');
    linesToAdd.push(SECTION_SEPARATOR);
    linesToAdd.push(MESSAGES.headers.missingOptional(new Date().toISOString()));
    linesToAdd.push(SECTION_SEPARATOR);
    linesToAdd.push(MESSAGES.headers.uncommentNote);
    linesToAdd.push(SECTION_SEPARATOR);
    linesToAdd.push('');

    for (const envVar of missingOptional) {
      linesToAdd.push(...formatOptionalVar(envVar));
    }
  }

  assertNotSymlink();

  fs.appendFileSync(ENV_OUTPUT_PATH, linesToAdd.join('\n'), 'utf-8');
  setFilePermissions(ENV_OUTPUT_PATH, MESSAGES.error.generic);

  console.log(MESSAGES.update.success);
  console.log('');

  if (missingRequired.length > 0) {
    console.log(MESSAGES.update.actionRequired);
    console.log(MESSAGES.update.reviewRequired);
    console.log(MESSAGES.update.updateValues);
    console.log('');
  }

  if (missingOptional.length > 0) {
    console.log(MESSAGES.update.optionalVarsTitle);
    console.log(MESSAGES.update.optionalCommented);
    console.log(MESSAGES.update.uncommentToOverride);
    console.log('');
  }
}

/**
 * Generate a new .env file from required variables.
 * Internal helper function used by both generateEnvFile and updateEnvFile.
 * Creates .env file with all required variables and commented optional ones.
 *
 * @returns void
 */
export function generateNewEnvFile(): void {
  const envVars = loadEnvJson();
  const requiredVars = envVars.filter((v) => v.required);
  const optionalVarsWithDefaults = envVars.filter(
    (v) => !v.required && v.defaultValue !== null,
  );

  const lines: Array<string> = [];

  lines.push(SECTION_SEPARATOR);
  lines.push('# Safe Client Gateway Environment Variables');
  lines.push(SECTION_SEPARATOR);
  lines.push(
    '# This file was generated from .env.sample.json with required variables and defaults.',
  );
  lines.push(
    '# Please update the placeholder values with your actual configuration.',
  );
  lines.push(SECTION_SEPARATOR);
  lines.push('');

  if (requiredVars.length > 0) {
    lines.push(SECTION_SEPARATOR);
    lines.push('# REQUIRED VARIABLES');
    lines.push(SECTION_SEPARATOR);
    lines.push('');

    for (const envVar of requiredVars) {
      lines.push(...formatRequiredVar(envVar));
    }
  }

  if (optionalVarsWithDefaults.length > 0) {
    lines.push(SECTION_SEPARATOR);
    lines.push('# OPTIONAL VARIABLES WITH DEFAULTS');
    lines.push(SECTION_SEPARATOR);
    lines.push(
      '# Uncomment and modify these variables if you want to override the defaults',
    );
    lines.push(SECTION_SEPARATOR);
    lines.push('');

    for (const envVar of optionalVarsWithDefaults) {
      lines.push(...formatOptionalVar(envVar));
    }
  }

  assertNotSymlink();

  fs.writeFileSync(ENV_OUTPUT_PATH, lines.join('\n'), 'utf-8');
  setFilePermissions(ENV_OUTPUT_PATH, MESSAGES.error.generic);

  console.log(MESSAGES.generate.success);
  console.log();
  console.log(MESSAGES.common.nextSteps);
  console.log(MESSAGES.common.step1);
  console.log(MESSAGES.common.step2);
  console.log(MESSAGES.common.step3);
  console.log();
}

/**
 * Generate .env file from required variables.
 * Creates a new .env file with all required variables and commented optional ones.
 * Fails if file already exists (unless FORCE_MODE).
 *
 * @returns void - Exits process with code 0 on success, 1 on failure
 */
export function generateEnvFile(): void {
  if (fs.existsSync(ENV_OUTPUT_PATH) && !FORCE_MODE) {
    console.error(MESSAGES.generate.fileExists);
    process.exit(1);
  }

  generateNewEnvFile();
}

/**
 * Main entry point.
 * Routes to appropriate function based on command-line flags.
 */
export function main(): void {
  if (UPDATE_MODE) {
    updateEnvFile();
  } else {
    generateEnvFile();
  }
}

if (process.env.NODE_ENV !== 'test') {
  try {
    main();
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(MESSAGES.error.generic(error.message));
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }

    console.error(MESSAGES.error.generic(String(error)));
    process.exit(1);
  }
}
