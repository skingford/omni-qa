import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import type { ParsedEndpoint, EndpointGroup } from '../openapi/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Register Handlebars helpers
Handlebars.registerHelper('lowerMethod', function (this: { method: string }) {
  return this.method.toLowerCase();
});

Handlebars.registerHelper('exampleValue', function (this: { schema?: Record<string, unknown>; example?: unknown; name: string }) {
  if (this.example !== undefined) {
    return JSON.stringify(this.example);
  }
  // Generate a sensible default based on schema type
  const type = this.schema?.type as string | undefined;
  switch (type) {
    case 'integer':
    case 'number':
      return '1';
    case 'boolean':
      return 'true';
    case 'array':
      return '[]';
    default:
      return `'test-${this.name}'`;
  }
});

interface GenerateOptions {
  source: string;
  outDir: string;
  filterTags?: string[];
}

/**
 * Generate .spec.ts test files from parsed endpoint groups.
 */
export async function generateTestFiles(
  groups: EndpointGroup[],
  options: GenerateOptions
): Promise<string[]> {
  const templatePath = resolve(__dirname, 'templates', 'api-spec.hbs');
  const templateSource = await readFile(templatePath, 'utf-8');
  const template = Handlebars.compile(templateSource);

  const generatedFiles: string[] = [];

  for (const group of groups) {
    // Filter by tags if specified
    if (options.filterTags && options.filterTags.length > 0) {
      const matchesTag = group.endpoints.some((ep) =>
        ep.tags.some((tag) => options.filterTags!.includes(tag))
      );
      if (!matchesTag) continue;
    }

    const fileName = slugify(group.name) + '.spec.ts';
    const filePath = resolve(options.outDir, fileName);

    // Skip if file already exists (don't overwrite user edits)
    if (existsSync(filePath)) {
      console.log(`  ⏭  Skipped (exists): ${fileName}`);
      continue;
    }

    const data = prepareTemplateData(group, options.source);
    const content = template(data);

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf-8');
    generatedFiles.push(filePath);
    console.log(`  ✓  Generated: ${fileName}`);
  }

  return generatedFiles;
}

function prepareTemplateData(group: EndpointGroup, source: string) {
  return {
    groupName: group.name,
    groupNameSlug: slugify(group.name),
    source,
    timestamp: new Date().toISOString(),
    endpoints: group.endpoints.map((ep) => ({
      ...ep,
      lowerMethod: ep.method.toLowerCase(),
      hasQueryParams: ep.parameters.some((p) => p.in === 'query'),
      queryParams: ep.parameters.filter((p) => p.in === 'query'),
      hasRequestBody: !!ep.requestBody,
      requestBodyExample: ep.requestBody?.example
        ? JSON.stringify(ep.requestBody.example, null, 2)
        : '{}',
      successSchema: ep.responses.find((r) => r.statusCode === '200')?.schema,
    })),
  };
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
