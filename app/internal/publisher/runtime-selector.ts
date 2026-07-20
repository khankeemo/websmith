/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: app/internal/publisher/runtime-selector.ts
 * Purpose: Selects appropriate runtime template for a given runtime
 * Author: Websmith
 *
 * RESPONSIBILITY:
 * - Map runtime names to template paths
 * - Validate supported runtimes
 * - Provide runtime metadata
 * ---------------------------------------------------------
 */

// RuntimeName type defined locally
export type RuntimeName = 'python' | 'node' | 'php' | 'java' | 'dotnet' | 'go' | 'rust' | 'cpp' | 'c' | 'javascript' | 'typescript' | 'bun' | 'deno';

export interface RuntimeInfo {
  name: RuntimeName;
  label: string;
  entryFile: string;
  supported: boolean;
}

export class RuntimeSelector {
  private static readonly RUNTIMES: Record<RuntimeName, RuntimeInfo> = {
    python: {
      name: 'python',
      label: 'Python',
      entryFile: '__init__.py',
      supported: true
    },
    node: {
      name: 'node',
      label: 'Node.js',
      entryFile: 'index.js',
      supported: true
    },
    php: {
      name: 'php',
      label: 'PHP',
      entryFile: 'Client.php',
      supported: true
    },
    java: {
      name: 'java',
      label: 'Java',
      entryFile: 'Client.java',
      supported: true
    },
    dotnet: {
      name: 'dotnet',
      label: '.NET',
      entryFile: 'Client.cs',
      supported: true
    },
    go: {
      name: 'go',
      label: 'Go',
      entryFile: 'client.go',
      supported: true
    },
    rust: {
      name: 'rust',
      label: 'Rust',
      entryFile: 'lib.rs',
      supported: true
    },
    cpp: {
      name: 'cpp',
      label: 'C++',
      entryFile: 'client.hpp',
      supported: true
    },
    c: {
      name: 'c',
      label: 'C',
      entryFile: 'client.h',
      supported: true
    },
    javascript: {
      name: 'javascript',
      label: 'JavaScript (Browser)',
      entryFile: 'websmith-client.js',
      supported: true
    },
    typescript: {
      name: 'typescript',
      label: 'TypeScript',
      entryFile: 'client.ts',
      supported: true
    },
    bun: {
      name: 'bun',
      label: 'Bun',
      entryFile: 'index.ts',
      supported: true
    },
    deno: {
      name: 'deno',
      label: 'Deno',
      entryFile: 'mod.ts',
      supported: true
    }
  };

  /**
   * Select runtime and return runtime info
   * This method is called by index.ts
   */
  async select(name: string): Promise<RuntimeInfo> {
    const runtime = this.getRuntimeInfo(name);
    if (!runtime) {
      throw new Error(`Runtime "${name}" is not supported. Supported runtimes: ${Object.keys(RuntimeSelector.RUNTIMES).join(', ')}`);
    }
    if (!runtime.supported) {
      throw new Error(`Runtime "${name}" is not yet supported. Coming soon!`);
    }
    return runtime;
  }

  /**
   * Get runtime info for a given runtime name
   */
  getRuntimeInfo(name: string): RuntimeInfo | null {
    const runtime = RuntimeSelector.RUNTIMES[name as RuntimeName];
    return runtime || null;
  }

  /**
   * Check if a runtime is supported
   */
  isSupported(name: string): boolean {
    const runtime = this.getRuntimeInfo(name);
    return runtime ? runtime.supported : false;
  }

  /**
   * Get all supported runtimes
   */
  getSupportedRuntimes(): RuntimeInfo[] {
    return Object.values(RuntimeSelector.RUNTIMES).filter(r => r.supported);
  }

  /**
   * Validate that a runtime exists and is supported
   */
  validateRuntime(name: string): void {
    const runtime = this.getRuntimeInfo(name);
    if (!runtime) {
      throw new Error(`Runtime "${name}" is not supported. Supported runtimes: ${Object.keys(RuntimeSelector.RUNTIMES).join(', ')}`);
    }
    if (!runtime.supported) {
      throw new Error(`Runtime "${name}" is not yet supported. Coming soon!`);
    }
  }
}

export default RuntimeSelector;