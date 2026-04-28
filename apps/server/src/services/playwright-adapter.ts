import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { runPlaywrightTests } from '@omni-qa/cli/testing/run-tests';
import type { ReportPreview, TestCase, TestResult } from '../domain/types.js';

export interface ExecuteCasesInput {
  runId: string;
  cases: TestCase[];
  envId: string;
  dataDir: string;
  cwd?: string;
  workers?: number;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface ExecuteCasesResult {
  success: boolean;
  durationMs: number;
  output: string;
  report: ReportPreview;
  results: TestResult[];
}

export interface ExecutionAdapter {
  execute(input: ExecuteCasesInput): Promise<ExecuteCasesResult>;
}

export class PlaywrightExecutionAdapter implements ExecutionAdapter {
  async execute(input: ExecuteCasesInput): Promise<ExecuteCasesResult> {
    const cwd = input.cwd ?? process.cwd();
    const runDir = await prepareRuntimeProject(cwd, input);

    const runResult = await runPlaywrightTests({
      cwd: runDir,
      env: input.envId,
      workers: input.workers ?? 1,
      outputLimit: 80_000,
      signal: input.signal,
    });

    const results = await parsePlaywrightResults(input.runId, input.cases, runResult.report.jsonPath);

    return {
      success: runResult.success,
      durationMs: runResult.durationMs,
      output: runResult.output,
      report: {
        htmlReportDir: runResult.report.htmlDir,
        jsonReportPath: runResult.report.jsonPath,
        outputPreview: runResult.output.slice(-4_000),
      },
      results,
    };
  }
}

async function prepareRuntimeProject(cwd: string, input: ExecuteCasesInput): Promise<string> {
  const runDir = join(input.dataDir, 'runtime-runs', input.runId);
  const testsDir = join(runDir, 'tests');
  await mkdir(testsDir, { recursive: true });

  const configPath = join(runDir, 'playwright.config.ts');
  await writeFile(
    configPath,
    [
      "import { createOmniPlaywrightConfig } from '@omni-qa/core/playwright';",
      '',
      "export default createOmniPlaywrightConfig({ testDir: './tests', reportDir: 'reports' });",
      '',
    ].join('\n'),
    'utf-8',
  );

  await linkOrCopy(resolve(cwd, 'omni-qa.config.ts'), join(runDir, 'omni-qa.config.ts'));

  const specPath = join(testsDir, `ai-run-${input.runId}.spec.ts`);
  await writeFile(specPath, renderRuntimeSpec(input.cases), 'utf-8');

  return runDir;
}

async function linkOrCopy(source: string, target: string): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  try {
    await symlink(source, target);
  } catch {
    await copyFile(source, target);
  }
}

function renderRuntimeSpec(cases: TestCase[]): string {
  const renderedCases = cases.map(renderCase).join('\n\n');
  return [
    "import { test, expect } from '@omni-qa/core/testing';",
    '',
    'async function jsonBody(response: { json: () => Promise<unknown> }): Promise<unknown> {',
    '  try { return await response.json(); } catch { return undefined; }',
    '}',
    '',
    'function jsonPath(value: unknown, path: string): unknown {',
    "  const parts = path.replace(/^\\$\\.?/, '').split('.').filter(Boolean);",
    '  let current: unknown = value;',
    '  for (const part of parts) {',
    "    if (!current || typeof current !== 'object') return undefined;",
    '    current = (current as Record<string, unknown>)[part];',
    '  }',
    '  return current;',
    '}',
    '',
    "test.describe('AI generated API cases', () => {",
    renderedCases,
    '});',
    '',
  ].join('\n');
}

function renderCase(testCase: TestCase): string {
  const method = testCase.request.method.toLowerCase();
  const options = {
    params: testCase.request.query,
    headers: testCase.request.headers,
    data: testCase.request.body,
  };
  const compactOptions = Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  );

  return [
    `  test(${js(`${testCase.name} [case:${testCase.id}]`)}, { tag: [${js(`@case-${testCase.id}`)}, '@ai-generated'] }, async ({ apiClient }) => {`,
    '    const startedAt = Date.now();',
    `    const response = await apiClient.${method}(${js(testCase.request.path)}, ${js(compactOptions)});`,
    '    const durationMs = Date.now() - startedAt;',
    renderAssertions(testCase),
    '  });',
  ].join('\n');
}

function renderAssertions(testCase: TestCase): string {
  const lines: string[] = [];
  let needsBody = false;

  for (const assertion of testCase.assertions) {
    if (assertion.type === 'jsonPath' || assertion.type === 'schema') {
      needsBody = true;
    }
  }

  if (needsBody) {
    lines.push('    const body = await jsonBody(response);');
  }

  for (const assertion of testCase.assertions) {
    switch (assertion.type) {
      case 'status':
        lines.push(renderExpect('response.status()', assertion.operator, assertion.expected));
        break;
      case 'header':
        lines.push(renderExpect(`response.headers()[${js(assertion.target ?? '')}]`, assertion.operator, assertion.expected));
        break;
      case 'jsonPath':
        lines.push(renderExpect(`jsonPath(body, ${js(assertion.target ?? '')})`, assertion.operator, assertion.expected));
        break;
      case 'schema':
        lines.push('    expect(body).toBeDefined();');
        break;
      case 'latency':
        lines.push(renderExpect('durationMs', assertion.operator, assertion.expected));
        break;
    }
  }

  return lines.join('\n');
}

function renderExpect(actual: string, operator: string, expected: unknown): string {
  switch (operator) {
    case 'eq':
      return `    expect(${actual}).toEqual(${js(expected)});`;
    case 'neq':
      return `    expect(${actual}).not.toEqual(${js(expected)});`;
    case 'contains':
      return `    expect(String(${actual})).toContain(${js(String(expected ?? ''))});`;
    case 'exists':
      return `    expect(${actual}).toBeDefined();`;
    case 'lt':
      return `    expect(${actual}).toBeLessThan(${js(expected)});`;
    case 'lte':
      return `    expect(${actual}).toBeLessThanOrEqual(${js(expected)});`;
    case 'gt':
      return `    expect(${actual}).toBeGreaterThan(${js(expected)});`;
    case 'gte':
      return `    expect(${actual}).toBeGreaterThanOrEqual(${js(expected)});`;
    default:
      return `    expect(${actual}).toBeDefined();`;
  }
}

async function parsePlaywrightResults(
  runId: string,
  cases: TestCase[],
  jsonPath: string,
): Promise<TestResult[]> {
  const now = new Date().toISOString();
  const caseById = new Map(cases.map((testCase) => [testCase.id, testCase]));

  try {
    const report = JSON.parse(await readFile(jsonPath, 'utf-8')) as PlaywrightJsonReport;
    const tests = collectReportTests(report.suites ?? []);
    const results: TestResult[] = [];

    for (const reportTest of tests) {
      const caseId = extractCaseId(reportTest.title);
      const testCase = caseId ? caseById.get(caseId) : undefined;
      if (!testCase) continue;

      const lastResult = reportTest.results.at(-1);
      const errorMessage = lastResult?.error?.message ?? lastResult?.errors?.[0]?.message;
      results.push({
        id: `result_${createHash('sha256').update(`${runId}:${testCase.id}`).digest('hex').slice(0, 20)}`,
        runId,
        caseId: testCase.id,
        endpointId: testCase.endpointId,
        status: reportTest.ok ? 'passed' : 'failed',
        durationMs: lastResult?.duration ?? 0,
        createdAt: now,
        error: errorMessage,
        assertionFailures: errorMessage ? [errorMessage] : undefined,
      });
    }

    return results;
  } catch (error) {
    return cases.map((testCase) => ({
      id: `result_${createHash('sha256').update(`${runId}:${testCase.id}`).digest('hex').slice(0, 20)}`,
      runId,
      caseId: testCase.id,
      endpointId: testCase.endpointId,
      status: 'failed',
      durationMs: 0,
      createdAt: now,
      error: error instanceof Error ? error.message : 'Failed to parse Playwright JSON report',
    }));
  }
}

function collectReportTests(suites: PlaywrightJsonSuite[]): PlaywrightReportCase[] {
  const tests: PlaywrightReportCase[] = [];
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      const lastTest = spec.tests?.at(-1);
      tests.push({
        title: spec.title,
        ok: spec.ok,
        results: lastTest?.results ?? [],
      });
    }
    tests.push(...collectReportTests(suite.suites ?? []));
  }
  return tests;
}

function extractCaseId(title: string): string | undefined {
  return /\[case:([^\]]+)\]/.exec(title)?.[1];
}

function js(value: unknown): string {
  return JSON.stringify(value);
}

interface PlaywrightJsonReport {
  suites?: PlaywrightJsonSuite[];
}

interface PlaywrightJsonSuite {
  suites?: PlaywrightJsonSuite[];
  specs?: PlaywrightJsonSpec[];
}

interface PlaywrightJsonSpec {
  title: string;
  ok: boolean;
  tests?: PlaywrightJsonTest[];
}

interface PlaywrightJsonTest {
  results: Array<{
    duration?: number;
    status?: string;
    error?: {
      message?: string;
    };
    errors?: Array<{
      message?: string;
    }>;
  }>;
}

interface PlaywrightReportCase {
  title: string;
  ok: boolean;
  results: PlaywrightJsonTest['results'];
}
