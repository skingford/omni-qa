import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CONFIG_FILE = 'omni-qa.config.ts';

interface PartialConfig {
  reportDir?: string;
}

export interface ReportPaths {
  rootDir: string;
  htmlDir: string;
  htmlIndexPath: string;
  jsonPath: string;
}

export interface ReportPreviewState extends ReportPaths {
  available: boolean;
  jsonExists: boolean;
  reportUrl: string;
}

export async function resolveReportPaths(cwd = process.cwd()): Promise<ReportPaths> {
  const configuredReportDir = await readConfiguredReportDir(cwd);
  const rootDir = resolve(cwd, configuredReportDir ?? 'reports');

  return {
    rootDir,
    htmlDir: resolve(rootDir, 'html'),
    htmlIndexPath: resolve(rootDir, 'html/index.html'),
    jsonPath: resolve(rootDir, 'results.json'),
  };
}

export async function getReportPreviewState(
  cwd = process.cwd(),
  reportBasePath = '/report-preview',
): Promise<ReportPreviewState> {
  const paths = await resolveReportPaths(cwd);

  return {
    ...paths,
    available: existsSync(paths.htmlIndexPath),
    jsonExists: existsSync(paths.jsonPath),
    reportUrl: `${reportBasePath.replace(/\/$/, '')}/index.html`,
  };
}

async function readConfiguredReportDir(cwd: string): Promise<string | undefined> {
  const configPath = resolve(cwd, CONFIG_FILE);
  if (!existsSync(configPath)) {
    return undefined;
  }

  try {
    const url = pathToFileURL(configPath);
    url.searchParams.set('t', String(Date.now()));
    const mod = await import(url.href);
    const config = (mod.default ?? mod) as PartialConfig;
    const reportDir = config.reportDir?.trim();
    return reportDir && reportDir.length > 0 ? reportDir : undefined;
  } catch {
    return undefined;
  }
}
