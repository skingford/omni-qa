import { Command } from 'commander';
import { resolve } from 'node:path';
import { parseOpenAPI, groupEndpoints } from '../../openapi/parser.js';
import { generateTestFiles } from '../../generator/index.js';

export const importCommand = new Command('import')
  .description('Import OpenAPI document and generate test files')
  .argument('<source>', 'OpenAPI document path or URL (yaml/json)')
  .option('-o, --out <dir>', 'Output directory for generated test files', 'tests/api')
  .option('-t, --tag <tags...>', 'Only generate tests for specific tags')
  .action(async (source: string, options: { out: string; tag?: string[] }) => {
    try {
      console.log(`\n📄 Importing OpenAPI document: ${source}\n`);

      // Parse
      console.log('  Parsing...');
      const api = await parseOpenAPI(source);
      console.log(`  ✓ ${api.title} v${api.version}`);
      console.log(`  ✓ Found ${api.endpoints.length} endpoints\n`);

      // Group
      const groups = groupEndpoints(api.endpoints);
      console.log(`  Groups: ${groups.map((g) => `${g.name}(${g.endpoints.length})`).join(', ')}\n`);

      // Generate
      const outDir = resolve(process.cwd(), options.out);
      console.log(`  Generating test files → ${outDir}\n`);

      const files = await generateTestFiles(groups, {
        source,
        outDir,
        filterTags: options.tag,
      });

      console.log(`\n✅ Generated ${files.length} test file(s)`);
      console.log('\nNext steps:');
      console.log('  1. Review generated files in', options.out);
      console.log('  2. Configure omni-qa.config.ts (environment, auth)');
      console.log('  3. Run tests: omni-qa run --env dev\n');
    } catch (err) {
      console.error(
        '\n❌ Import failed:',
        err instanceof Error ? err.message : err
      );
      process.exit(1);
    }
  });
