import { PublisherContext } from '../index';
import { getPythonTemplates } from './python';
import { getNodeTemplates } from './node';
import { getPhpTemplates } from './php';
import { getJavaTemplates } from './java';
import { getDotNetTemplates } from './dotnet';
import { getGoTemplates } from './go';
import { getRustTemplates } from './rust';
import { getCppTemplates } from './cpp';
import { getCTemplates } from './c';
import { getJavaScriptTemplates } from './javascript';
import { getTypeScriptTemplates } from './typescript';
import { getBunTemplates } from './bun';
import { getDenoTemplates } from './deno';

export type RuntimeName = 'python' | 'node' | 'php' | 'java' | 'dotnet' | 'go' | 'rust' | 'cpp' | 'c' | 'javascript' | 'typescript' | 'bun' | 'deno';

const runtimeGenerators: Record<RuntimeName, (ctx: PublisherContext) => Record<string, string>> = {
  python: getPythonTemplates,
  node: getNodeTemplates,
  php: getPhpTemplates,
  java: getJavaTemplates,
  dotnet: getDotNetTemplates,
  go: getGoTemplates,
  rust: getRustTemplates,
  cpp: getCppTemplates,
  c: getCTemplates,
  javascript: getJavaScriptTemplates,
  typescript: getTypeScriptTemplates,
  bun: getBunTemplates,
  deno: getDenoTemplates,
};

export function getRuntimeTemplates(runtime: string, context: PublisherContext): Record<string, string> {
  const generator = runtimeGenerators[runtime as RuntimeName];
  if (!generator) {
    throw new Error(`Runtime "${runtime}" is not supported`);
  }
  return generator(context);
}


