/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: app/internal/publisher/sdk-validator.ts
 * Purpose: Environment-aware SDK package validation
 * Author: Websmith
 *
 * CRITICAL DESIGN RULE:
 * This validator must NEVER assume any interpreter exists.
 * - Missing python/node/go/rust/etc = WARNING, not error
 * - Generation MUST continue regardless
 * - Only real syntax errors (when interpreter IS available) fail generation
 *
 * RESPONSIBILITY:
 * 1. Package integrity (files exist, expected structure)
 * 2. Config integrity (api-config.json fields)
 * 3. Manifest integrity (manifest.json fields)
 * 4. Runtime file analysis (imports, code patterns)
 * 5. README validation (all lifecycle sections present)
 * 6. Syntax validation (environment-aware, optional)
 * ---------------------------------------------------------
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export interface SyntaxValidationInfo {
  supported: boolean;
  reason?: string;
}

export interface ValidationReport {
  runtime: string;
  zip_valid: boolean;
  manifest_valid: boolean;
  config_valid: boolean;
  readme_valid: boolean;
  syntax_validation: SyntaxValidationInfo;
  errors: string[];
  warnings: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checks: {
    files: number;
    passed: number;
    failed: number;
  };
  report?: ValidationReport;
}

export class SDKValidator {
  async validate(packageDir: string, runtime: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      checks: { files: 0, passed: 0, failed: 0 },
    };

    // Stage 1: Package integrity (always runs, errors fail generation)
    await this.checkPackageIntegrity(packageDir, runtime, result);

    // Stage 2: Config integrity (always runs)
    if (result.errors.length === 0) {
      await this.checkConfigIntegrity(packageDir, result);
    }

    // Stage 3: Manifest integrity (always runs)
    if (result.errors.length === 0) {
      await this.checkManifestIntegrity(packageDir, result);
    }

    // Stage 4: Runtime file analysis (always runs — checks imports, code patterns)
    if (result.errors.length === 0) {
      await this.checkRuntimeFiles(packageDir, runtime, result);
    }

    // Stage 5: README validation (always runs)
    if (result.errors.length === 0) {
      await this.checkReadme(packageDir, runtime, result);
    }

    // Stage 6: Syntax validation (environment-aware — only if interpreter available)
    if (result.errors.length === 0) {
      const syntaxInfo = await this.validateSyntax(packageDir, runtime, result);
      result.report = this.buildReport(runtime, result, syntaxInfo);
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  private buildReport(
    runtime: string,
    result: ValidationResult,
    syntaxInfo: SyntaxValidationInfo
  ): ValidationReport {
    return {
      runtime,
      zip_valid: result.checks.files > 0,
      manifest_valid: !result.errors.some(e => e.includes('manifest')),
      config_valid: !result.errors.some(e => e.includes('api-config')),
      readme_valid: !result.errors.some(e => e.includes('README')) && !result.errors.some(e => e.includes('Integrations')),
      syntax_validation: syntaxInfo,
      errors: result.errors,
      warnings: result.warnings,
    };
  }

  // ──────────────────────────────────────────────────────────
  // STAGE 1: PACKAGE INTEGRITY
  // ──────────────────────────────────────────────────────────

  private async checkPackageIntegrity(
    packageDir: string,
    runtime: string,
    result: ValidationResult
  ): Promise<void> {
    try {
      const stat = await fs.stat(packageDir);
      if (!stat.isDirectory()) {
        result.errors.push(`Package path is not a directory: ${packageDir}`);
        return;
      }
    } catch (err: any) {
      result.errors.push(`Package directory not found: ${packageDir} (${err.message})`);
      return;
    }

    const files = await this.listFilesRecursive(packageDir);
    result.checks.files = files.length;

    if (files.length === 0) {
      result.errors.push('Package directory is empty');
      return;
    }

    const hasConfig = files.some(f => f.endsWith('api-config.json'));
    const hasManifest = files.some(f => f.endsWith('manifest.json'));
    const hasReadme = files.some(f => f.toLowerCase().endsWith(runtime === 'python' ? 'integrations.md' : 'readme.md'));

    if (!hasConfig) result.errors.push('Missing api-config.json in generated package');
    if (!hasManifest) result.errors.push('Missing manifest.json in generated package');
    if (!hasReadme) result.warnings.push(runtime === 'python' ? 'Missing Integrations.md in generated package' : 'Missing README.md in generated package');

    // Check for runtime entry file
    const entryFiles: Record<string, string[]> = {
      python: ['__init__.py'],
      node: ['index.js', 'client.js'],
      php: ['Client.php'],
      java: ['Client.java'],
      dotnet: ['Client.cs'],
      go: ['client.go'],
      rust: ['lib.rs'],
      cpp: ['client.hpp'],
      c: ['client.h'],
      javascript: ['websmith-client.js', 'client.js'],
      typescript: ['client.ts'],
      bun: ['client.js'],
      deno: ['client.ts'],
    };

    const expected = entryFiles[runtime] || ['client.js'];
    const hasEntry = expected.some(entry => files.some(f => f.endsWith(entry)));
    if (!hasEntry) {
      result.warnings.push(
        `Could not find expected entry file(s) for runtime "${runtime}": ${expected.join(', ')}`
      );
    }

    if (result.errors.length === 0) result.checks.passed++;
  }

  // ──────────────────────────────────────────────────────────
  // STAGE 2: CONFIG INTEGRITY
  // ──────────────────────────────────────────────────────────

  private async checkConfigIntegrity(
    packageDir: string,
    result: ValidationResult
  ): Promise<void> {
    const configPaths = [
      path.join(packageDir, 'config', 'api-config.json'),
      path.join(packageDir, 'api-config.json'),
    ];
    let configPath = '';
    for (const cp of configPaths) {
      try {
        await fs.access(cp);
        configPath = cp;
        break;
      } catch { /* try next */ }
    }
    if (!configPath) {
      result.errors.push('api-config.json not found');
      return;
    }

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      const requiredSections = ['product', 'api', 'license'];
      for (const section of requiredSections) {
        if (!config[section]) {
          result.errors.push(`api-config.json missing required section: ${section}`);
        }
      }

      if (config.product) {
        if (!config.product.id) result.errors.push('api-config.json product missing id');
        if (!config.product.name) result.errors.push('api-config.json product missing name');
        if (!config.product.version) result.warnings.push('api-config.json product missing version');
      }

      if (config.api) {
        if (!config.api.url) result.errors.push('api-config.json api missing url');
        if (!config.api.public_key) result.warnings.push('api-config.json api missing public_key');
      }

      if (config.license) {
        if (config.license.max_devices === undefined) result.warnings.push('api-config.json license missing max_devices');
        if (config.license.offline_days === undefined) result.warnings.push('api-config.json license missing offline_days');
      }

      if (config.store) {
        if (!config.store.buy_url) result.errors.push('api-config.json store missing buy_url (no empty strings)');
        if (!config.store.renew_url) result.errors.push('api-config.json store missing renew_url (no empty strings)');
      }

      if (result.errors.length === 0) result.checks.passed++;
    } catch (err: any) {
      result.errors.push(`api-config.json validation failed: ${err.message}`);
    }
  }

  // ──────────────────────────────────────────────────────────
  // STAGE 3: MANIFEST INTEGRITY
  // ──────────────────────────────────────────────────────────

  private async checkManifestIntegrity(
    packageDir: string,
    result: ValidationResult
  ): Promise<void> {
    const manifestPaths = [
      path.join(packageDir, 'manifest.json'),
    ];
    let manifestPath = '';
    for (const mp of manifestPaths) {
      try {
        await fs.access(mp);
        manifestPath = mp;
        break;
      } catch { /* try next */ }
    }
    if (!manifestPath) {
      result.errors.push('manifest.json not found');
      return;
    }

    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);

      const requiredFields = ['kit_version', 'api_version', 'runtime', 'generated_at', 'product_id', 'product_name'];
      for (const field of requiredFields) {
        if (!manifest[field]) {
          result.errors.push(`manifest.json missing required field: ${field}`);
        }
      }

      if (result.errors.length === 0) result.checks.passed++;
    } catch (err: any) {
      result.errors.push(`manifest.json validation failed: ${err.message}`);
    }
  }

  // ──────────────────────────────────────────────────────────
  // STAGE 4: RUNTIME FILE ANALYSIS
  // ──────────────────────────────────────────────────────────

  private async checkRuntimeFiles(
    packageDir: string,
    runtime: string,
    result: ValidationResult
  ): Promise<void> {
    // Check all source files for common issues
    const files = await this.listFilesRecursive(packageDir);

    // Check for success/restart workflow in Python packages
    if (runtime === 'python') {
      const pyFiles = files.filter(f => f.endsWith('.py'));
      const initPy = pyFiles.find(f => f.endsWith('__init__.py'));
      const ulcPy = pyFiles.find(f => f.endsWith('universal_license_center.py'));

      // __init__.py must export both dialogs
      if (initPy) {
        const initContent = await fs.readFile(initPy, 'utf-8');
        if (!initContent.includes('SuccessDialog')) {
          result.errors.push(
            `Universal Success Dialog (SuccessDialog) missing from ${path.relative(packageDir, initPy)}`
          );
        }
        if (!initContent.includes('RestartDialog')) {
          result.errors.push(
            `Universal Restart Dialog (RestartDialog) missing from ${path.relative(packageDir, initPy)}`
          );
        }
      }

      // universal_license_center.py uses SuccessDialog directly
      if (ulcPy) {
        const ulcContent = await fs.readFile(ulcPy, 'utf-8');
        if (!ulcContent.includes('SuccessDialog')) {
          result.errors.push(
            `Universal Success Dialog (SuccessDialog) missing from ${path.relative(packageDir, ulcPy)}`
          );
        }
      }
    }

    // Check for required API methods in runtime client files
    const methodChecks: Record<string, { filePattern: string; methods: string[] }> = {
      python: {
        filePattern: 'client.py',
        methods: ['get_products', 'validate_license', 'activate_license', 'get_trial_status']
      },
      node: {
        filePattern: 'client.js',
        methods: ['getProducts', 'validateLicense', 'activateLicense', 'getTrialStatus']
      },
      typescript: {
        filePattern: 'client.ts',
        methods: ['getProducts', 'validateLicense', 'activateLicense', 'getTrialStatus']
      },
      go: {
        filePattern: 'client.go',
        methods: ['GetProducts', 'ValidateLicense', 'ActivateLicense', 'GetTrialStatus']
      },
      rust: {
        filePattern: 'client.rs',
        methods: ['get_products', 'validate_license', 'activate_license', 'get_trial_status']
      },
      java: {
        filePattern: 'Client.java',
        methods: ['getProducts', 'validateLicense', 'activateLicense', 'getTrialStatus']
      },
      dotnet: {
        filePattern: 'Client.cs',
        methods: ['GetProducts', 'ValidateLicense', 'ActivateLicense', 'GetTrialStatus']
      },
      php: {
        filePattern: 'Client.php',
        methods: ['getProducts', 'validateLicense', 'activateLicense', 'getTrialStatus']
      },
      cpp: {
        filePattern: 'client.hpp',
        methods: ['getProducts', 'validateLicense', 'activateLicense', 'getTrialStatus']
      },
      c: {
        filePattern: 'client.h',
        methods: ['get_products', 'validate_license', 'activate_license', 'get_trial_status']
      },
      javascript: {
        filePattern: 'client.js',
        methods: ['getProducts', 'validateLicense', 'activateLicense', 'getTrialStatus']
      },
      bun: {
        filePattern: 'client.js',
        methods: ['getProducts', 'validateLicense', 'activateLicense', 'getTrialStatus']
      },
      deno: {
        filePattern: 'client.ts',
        methods: ['getProducts', 'validateLicense', 'activateLicense', 'getTrialStatus']
      },
    };

    const runtimeMethodCheck = methodChecks[runtime];
    if (runtimeMethodCheck) {
      const matchingFiles = files.filter(f => f.endsWith(runtimeMethodCheck.filePattern));
      for (const clientFile of matchingFiles) {
        const content = await fs.readFile(clientFile, 'utf-8');
        for (const method of runtimeMethodCheck.methods) {
          if (!content.includes(method)) {
            result.errors.push(
              `Required method "${method}" not found in ${path.relative(packageDir, clientFile)}`
            );
          }
        }
      }
    }

    // Runtime-specific file pattern checks
    const pyFiles = files.filter(f => f.endsWith('.py'));
    for (const pyFile of pyFiles) {
      const content = await fs.readFile(pyFile, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();

        // Check for from .xxx import YYY resolution
        const importMatch = trimmed.match(/^from\s+\.(\w+)\s+import/);
        if (importMatch) {
          const moduleName = importMatch[1];
          const moduleFile = path.join(path.dirname(pyFile), `${moduleName}.py`);
          try {
            await fs.access(moduleFile);
          } catch {
            result.warnings.push(
              `Import "${trimmed}" in ${path.relative(packageDir, pyFile)} references non-existent module`
            );
          }
        }

        // Check for bare except Exception
        if (trimmed.startsWith('except Exception:')) {
          result.warnings.push(
            `Bare "except Exception:" found in ${path.relative(packageDir, pyFile)}`
          );
        }
        if (trimmed.startsWith('except:') || /^except\s+Exception\s*:/.test(trimmed)) {
          result.warnings.push(
            `Bare "except" without exception type in ${path.relative(packageDir, pyFile)}`
          );
        }
      }

      result.checks.passed++;
    }

    // Check for Node.js require resolution
    const jsFiles = files.filter(f => f.endsWith('.js'));
    for (const jsFile of jsFiles) {
      const content = await fs.readFile(jsFile, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        // Check for require('./xxx') resolution
        const requireMatch = trimmed.match(/require\(['"]\.\/(\w[\w.-]*)['"]\)/);
        if (requireMatch) {
          const moduleName = requireMatch[1];
          // Try with .js extension
          const moduleFileJs = path.join(path.dirname(jsFile), `${moduleName}.js`);
          const moduleFileTs = path.join(path.dirname(jsFile), `${moduleName}.ts`);
          try {
            await fs.access(moduleFileJs);
          } catch {
            try {
              await fs.access(moduleFileTs);
            } catch {
              result.warnings.push(
                `require("${trimmed.match(/['"]\.\/[\w.-]*['"]/)?.[0] || moduleName}") in ${path.relative(packageDir, jsFile)} references non-existent module`
              );
            }
          }
        }
      }
    }

    result.checks.files += pyFiles.length + jsFiles.length;
  }

  // ──────────────────────────────────────────────────────────
  // STAGE 5: README VALIDATION
  // ──────────────────────────────────────────────────────────

  private async checkReadme(
    packageDir: string,
    runtime: string,
    result: ValidationResult
  ): Promise<void> {
    const docCandidates = runtime === 'python'
      ? ['Integrations.md', 'integrations.md']
      : ['README.md', 'readme.md'];
    const docName = runtime === 'python' ? 'Integrations.md' : 'README.md';
    const readmePaths = docCandidates.map(name => path.join(packageDir, name));
    let readmePath = '';
    for (const rp of readmePaths) {
      try {
        await fs.access(rp);
        readmePath = rp;
        break;
      } catch { /* try next */ }
    }

    if (!readmePath) {
      result.warnings.push(`${docName} not found in generated package`);
      return;
    }

    try {
      const content = await fs.readFile(readmePath, 'utf-8');
      if (!content.trim()) {
        result.warnings.push(`${docName} is empty`);
        return;
      }

      // Check for all lifecycle sections relevant to the runtime's documentation file
      const lifecycleSections = runtime === 'python'
        ? [
            '1. Introduction',
            '2. Install',
            '3. Configuration',
            '4. Quick start',
            '5. Core components',
            '6. Workflows',
            '7. API reference',
            '8. Error handling',
            '9. Best practices',
            '10. Troubleshooting',
          ]
        : [
            'Installation',
            'Quick Start',
            'Configuration',
            'API Endpoints',
            'Initialize & Validate',
            'Start Trial',
            'Activate License',
            'Renew License',
            'View Hardware Status',
            'Deactivate License',
            'Bind Device',
            'HMAC',
          ];
      const missing: string[] = [];
      for (const section of lifecycleSections) {
        if (!content.includes(`## ${section}`) && !content.includes(`## ${section}`.toLowerCase())) {
          missing.push(section);
        }
      }
      if (missing.length > 0) {
        result.warnings.push(`${docName} missing lifecycle sections: ${missing.join(', ')}`);
      }

      result.checks.passed++;
    } catch {
      result.warnings.push(`${docName} not found in generated package`);
    }
  }

  // ──────────────────────────────────────────────────────────
  // STAGE 6: ENVIRONMENT-AWARE SYNTAX VALIDATION
  // ──────────────────────────────────────────────────────────

  private async validateSyntax(
    packageDir: string,
    runtime: string,
    result: ValidationResult
  ): Promise<SyntaxValidationInfo> {
    const syntaxValidators: Record<string, (d: string, r: ValidationResult) => Promise<boolean>> = {
      python: this.validatePythonSyntax.bind(this),
      node: this.validateNodeSyntax.bind(this),
      typescript: this.validateTypeScriptSyntax.bind(this),
      php: this.validatePhpSyntax.bind(this),
      java: this.validateJavaSyntax.bind(this),
      dotnet: this.validateDotNetSyntax.bind(this),
      go: this.validateGoSyntax.bind(this),
      rust: this.validateRustSyntax.bind(this),
      cpp: this.validateCppSyntax.bind(this),
      c: this.validateCSyntax.bind(this),
      javascript: this.validateJavaScriptSyntax.bind(this),
      bun: this.validateBunSyntax.bind(this),
      deno: this.validateDenoSyntax.bind(this),
    };

    const validator = syntaxValidators[runtime];
    if (!validator) {
      return { supported: false, reason: `No syntax validator for runtime "${runtime}"` };
    }

    const supported = await validator(packageDir, result);
    return supported
      ? { supported: true }
      : { supported: false, reason: `Interpreter not available in this environment` };
  }

  /**
   * Check if an interpreter is actually runnable. Returns true if the
   * interpreter responds to --version successfully.
   * Uses 'where' (Windows) or 'which' (POSIX) to find, then --version to verify.
   */
  private async interpreterExists(name: string): Promise<boolean> {
    try {
      // First check if the command exists in PATH
      execSync(`where ${name} 2>nul || which ${name} 2>/dev/null`, {
        timeout: 5000,
        stdio: 'pipe',
      });
      // Then verify it actually works (not a Windows Store redirect)
      execSync(`${name} --version 2>&1`, {
        timeout: 5000,
        stdio: 'pipe',
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Run a compiler/interpreter check command.
   * If the command fails AND the error is a genuine syntax error,
   * it pushes an ERROR. If the tool simply isn't available or fails
   * for non-syntax reasons, it pushes a WARNING.
   */
  private async runSyntaxCheck(
    cmd: string,
    cwd: string,
    label: string,
    result: ValidationResult
  ): Promise<void> {
    try {
      execSync(cmd, { cwd, timeout: 30000, stdio: 'pipe' });
      result.checks.passed++;
    } catch (err: any) {
      const stderr = (err.stderr?.toString() || err.message || '').trim();
      const isSyntaxError = /syntax|error:|unexpected|parse|SyntaxError|E\d{4,}/i.test(stderr);
      if (isSyntaxError) {
        result.errors.push(`${label}: ${stderr.split('\n').pop()}`);
        result.checks.failed++;
      } else {
        result.warnings.push(`${label} could not complete: ${stderr.split('\n').pop()}`);
      }
    }
  }

  // ──────────────────────────────────────────────────────────
  // RUNTIME-SPECIFIC SYNTAX VALIDATORS
  // Each returns true if the interpreter is available.
  // ──────────────────────────────────────────────────────────

  private async validatePythonSyntax(
    packageDir: string,
    result: ValidationResult
  ): Promise<boolean> {
    // Check for python3 or python
    const hasPython = await this.interpreterExists('python3')
      || await this.interpreterExists('python');
    if (!hasPython) {
      result.warnings.push('Python interpreter unavailable in this environment. Syntax validation skipped.');
      return false;
    }

    const pyCmd = await this.interpreterExists('python3') ? 'python3' : 'python';
    const pyFiles = (await this.listFilesRecursive(packageDir))
      .filter(f => f.endsWith('.py'));

    if (pyFiles.length === 0) {
      result.warnings.push('No Python files found to validate');
      return true;
    }

    for (const pyFile of pyFiles) {
      await this.runSyntaxCheck(
        `${pyCmd} -m py_compile "${pyFile}"`,
        packageDir,
        `Python syntax: ${path.relative(packageDir, pyFile)}`,
        result
      );
    }

    return true;
  }

  private async validateNodeSyntax(
    packageDir: string,
    result: ValidationResult
  ): Promise<boolean> {
    const hasNode = await this.interpreterExists('node');
    if (!hasNode) {
      result.warnings.push('Node.js interpreter unavailable in this environment. Syntax validation skipped.');
      return false;
    }

    const jsFiles = (await this.listFilesRecursive(packageDir))
      .filter(f => f.endsWith('.js'))
      .filter(f => !f.includes('node_modules'));

    if (jsFiles.length === 0) {
      result.warnings.push('No JavaScript files found to validate for Node.js');
      return true;
    }

    for (const jsFile of jsFiles) {
      await this.runSyntaxCheck(
        `node --check "${jsFile}"`,
        packageDir,
        `Node.js syntax: ${path.relative(packageDir, jsFile)}`,
        result
      );
    }

    return true;
  }

  private async validateTypeScriptSyntax(
    packageDir: string,
    result: ValidationResult
  ): Promise<boolean> {
    const hasTsc = await this.interpreterExists('tsc');
    if (!hasTsc) {
      // Fallback: check npx tsc
      const hasNpx = await this.interpreterExists('npx');
      if (!hasNpx) {
        result.warnings.push('TypeScript compiler unavailable in this environment. Type check skipped.');
        return false;
      }
    }

    const tsFiles = (await this.listFilesRecursive(packageDir))
      .filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'));

    if (tsFiles.length === 0) {
      result.warnings.push('No TypeScript files found to validate');
      return true;
    }

    await this.runSyntaxCheck(
      `npx tsc --noEmit --strict --target ES2020 --moduleResolution bundler 2>&1 || true`,
      packageDir,
      'TypeScript type check',
      result
    );

    return true;
  }

  private async validatePhpSyntax(
    packageDir: string,
    result: ValidationResult
  ): Promise<boolean> {
    const hasPhp = await this.interpreterExists('php');
    if (!hasPhp) {
      result.warnings.push('PHP interpreter unavailable in this environment. Syntax validation skipped.');
      return false;
    }

    const phpFiles = (await this.listFilesRecursive(packageDir))
      .filter(f => f.endsWith('.php'));

    if (phpFiles.length === 0) {
      result.warnings.push('No PHP files found to validate');
      return true;
    }

    for (const phpFile of phpFiles) {
      await this.runSyntaxCheck(
        `php -l "${phpFile}"`,
        packageDir,
        `PHP lint: ${path.relative(packageDir, phpFile)}`,
        result
      );
    }

    return true;
  }

  private async validateJavaSyntax(
    packageDir: string,
    result: ValidationResult
  ): Promise<boolean> {
    const hasJavac = await this.interpreterExists('javac');
    if (!hasJavac) {
      result.warnings.push('Java compiler unavailable in this environment. Compilation skipped.');
      return false;
    }

    const javaFiles = (await this.listFilesRecursive(packageDir))
      .filter(f => f.endsWith('.java'));

    if (javaFiles.length === 0) {
      result.warnings.push('No Java files found to validate');
      return true;
    }

    const buildDir = path.join(packageDir, 'build');
    try { await fs.mkdir(buildDir, { recursive: true }); } catch { /* ignore */ }

    for (const javaFile of javaFiles) {
      await this.runSyntaxCheck(
        `javac -d "${buildDir}" "${javaFile}" 2>&1 || true`,
        packageDir,
        `Java compile: ${path.relative(packageDir, javaFile)}`,
        result
      );
    }

    return true;
  }

  private async validateDotNetSyntax(
    packageDir: string,
    result: ValidationResult
  ): Promise<boolean> {
    const hasDotnet = await this.interpreterExists('dotnet');
    if (!hasDotnet) {
      result.warnings.push('.NET SDK unavailable in this environment. Build skipped.');
      return false;
    }

    const csprojFiles = (await this.listFilesRecursive(packageDir))
      .filter(f => f.endsWith('.csproj'));

    if (csprojFiles.length === 0) {
      result.warnings.push('No .csproj found, skipping .NET build');
      return true;
    }

    await this.runSyntaxCheck(
      `dotnet build "${csprojFiles[0]}" --nologo -v q 2>&1 || true`,
      packageDir,
      '.NET build',
      result
    );

    return true;
  }

  private async validateGoSyntax(
    packageDir: string,
    result: ValidationResult
  ): Promise<boolean> {
    const hasGo = await this.interpreterExists('go');
    if (!hasGo) {
      result.warnings.push('Go compiler unavailable in this environment. Build skipped.');
      return false;
    }

    const goFiles = (await this.listFilesRecursive(packageDir))
      .filter(f => f.endsWith('.go'));
    if (goFiles.length === 0) {
      result.warnings.push('No Go files found to validate');
      return true;
    }

    await this.runSyntaxCheck(
      `go vet ./... 2>&1 || true`,
      packageDir,
      'Go vet',
      result
    );

    return true;
  }

  private async validateRustSyntax(
    packageDir: string,
    result: ValidationResult
  ): Promise<boolean> {
    const hasCargo = await this.interpreterExists('cargo');
    if (!hasCargo) {
      result.warnings.push('Cargo/Rust compiler unavailable in this environment. Build skipped.');
      return false;
    }

    const hasCargoToml = (await this.listFilesRecursive(packageDir))
      .some(f => f.endsWith('Cargo.toml'));
    if (!hasCargoToml) {
      result.warnings.push('No Cargo.toml found, skipping Rust validation');
      return false;
    }

    await this.runSyntaxCheck(
      `cargo check 2>&1 || true`,
      packageDir,
      'Rust cargo check',
      result
    );

    return true;
  }

  private async validateCppSyntax(
    packageDir: string,
    result: ValidationResult
  ): Promise<boolean> {
    const hasGpp = await this.interpreterExists('g++');
    if (!hasGpp) {
      result.warnings.push('C++ compiler (g++) unavailable in this environment. Syntax check skipped.');
      return false;
    }

    const hppFiles = (await this.listFilesRecursive(packageDir))
      .filter(f => f.endsWith('.hpp') || f.endsWith('.cpp') || f.endsWith('.h'));

    if (hppFiles.length === 0) {
      result.warnings.push('No C++ files found to validate');
      return true;
    }

    for (const hppFile of hppFiles.slice(0, 3)) {
      const ext = path.extname(hppFile);
      const cmd = ext === '.cpp'
        ? `g++ -fsyntax-only -std=c++17 "${hppFile}" 2>&1 || true`
        : `g++ -fsyntax-only -std=c++17 -x c++ "${hppFile}" 2>&1 || true`;
      await this.runSyntaxCheck(cmd, packageDir, `C++ syntax: ${path.relative(packageDir, hppFile)}`, result);
    }

    return true;
  }

  private async validateCSyntax(
    packageDir: string,
    result: ValidationResult
  ): Promise<boolean> {
    const hasGcc = await this.interpreterExists('gcc');
    if (!hasGcc) {
      result.warnings.push('C compiler (gcc) unavailable in this environment. Syntax check skipped.');
      return false;
    }

    const cFiles = (await this.listFilesRecursive(packageDir))
      .filter(f => f.endsWith('.h') || f.endsWith('.c'));

    if (cFiles.length === 0) {
      result.warnings.push('No C files found to validate');
      return true;
    }

    for (const cFile of cFiles.slice(0, 3)) {
      await this.runSyntaxCheck(
        `gcc -fsyntax-only -std=c11 -x c "${cFile}" 2>&1 || true`,
        packageDir,
        `C syntax: ${path.relative(packageDir, cFile)}`,
        result
      );
    }

    return true;
  }

  private async validateJavaScriptSyntax(
    packageDir: string,
    result: ValidationResult
  ): Promise<boolean> {
    const hasNode = await this.interpreterExists('node');
    if (!hasNode) {
      result.warnings.push('Node.js interpreter unavailable for JS syntax check. Skipped.');
      return false;
    }

    const jsFiles = (await this.listFilesRecursive(packageDir))
      .filter(f => f.endsWith('.js'));
    if (jsFiles.length === 0) {
      result.warnings.push('No JavaScript files found to validate');
      return true;
    }

    for (const jsFile of jsFiles) {
      await this.runSyntaxCheck(
        `node --check "${jsFile}"`,
        packageDir,
        `JavaScript syntax: ${path.relative(packageDir, jsFile)}`,
        result
      );
    }

    return true;
  }

  private async validateBunSyntax(
    packageDir: string,
    result: ValidationResult
  ): Promise<boolean> {
    const hasBun = await this.interpreterExists('bun');
    if (!hasBun) {
      result.warnings.push('Bun runtime unavailable in this environment. Syntax check skipped.');
      return false;
    }

    await this.runSyntaxCheck(
      `bun build --check ./client.js 2>&1 || true`,
      packageDir,
      'Bun build check',
      result
    );

    return true;
  }

  private async validateDenoSyntax(
    packageDir: string,
    result: ValidationResult
  ): Promise<boolean> {
    const hasDeno = await this.interpreterExists('deno');
    if (!hasDeno) {
      result.warnings.push('Deno runtime unavailable in this environment. Syntax check skipped.');
      return false;
    }

    const tsFiles = (await this.listFilesRecursive(packageDir))
      .filter(f => f.endsWith('.ts'));
    if (tsFiles.length === 0) {
      result.warnings.push('No TypeScript files found to validate for Deno');
      return false;
    }

    const firstTs = tsFiles[0];
    await this.runSyntaxCheck(
      `deno check "${firstTs}" 2>&1 || true`,
      packageDir,
      `Deno check: ${path.relative(packageDir, firstTs)}`,
      result
    );

    return true;
  }

  // ──────────────────────────────────────────────────────────
  // UTILITY
  // ──────────────────────────────────────────────────────────

  private async listFilesRecursive(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const subFiles = await this.listFilesRecursive(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist
    }
    return files;
  }
}

export default SDKValidator;
