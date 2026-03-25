import { resolve } from 'node:path';
import { generateTestFiles } from '@omni-qa/core/generator';
import { groupEndpoints, parseOpenAPI } from '@omni-qa/core/openapi/parser';

export interface RunImportOptions {
  cwd?: string;
  source: string;
  outDir: string;
  tags?: string[];
  force?: boolean;
}

export interface ImportGroupSummary {
  name: string;
  endpoints: number;
}

export interface RunImportResult {
  source: string;
  apiTitle: string;
  apiVersion: string;
  endpointCount: number;
  outDir: string;
  tags: string[];
  groups: ImportGroupSummary[];
  generatedFiles: string[];
}

export async function runOpenApiImport(options: RunImportOptions): Promise<RunImportResult> {
  const cwd = options.cwd ?? process.cwd();
  const tags = normalizeTags(options.tags);

  const api = await parseOpenAPI(options.source);
  const groups = groupEndpoints(api.endpoints);
  const outDir = resolve(cwd, options.outDir);

  const generatedFiles = await generateTestFiles(groups, {
    source: options.source,
    outDir,
    filterTags: tags.length > 0 ? tags : undefined,
    overwrite: options.force,
  });

  return {
    source: options.source,
    apiTitle: api.title,
    apiVersion: api.version,
    endpointCount: api.endpoints.length,
    outDir,
    tags,
    groups: groups.map((group) => ({
      name: group.name,
      endpoints: group.endpoints.length,
    })),
    generatedFiles,
  };
}

function normalizeTags(tags?: string[]): string[] {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}
