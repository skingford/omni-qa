import { Command } from 'commander';
import { runOpenApiImport } from '../../openapi/run-import.js';

export const importCommand = new Command('import')
  .description('Import OpenAPI document and generate test files')
  .argument('<source>', 'OpenAPI document path or URL (yaml/json)')
  .option('-o, --out <dir>', 'Output directory for generated test files', 'tests/api')
  .option('-t, --tag <tags...>', 'Only generate tests for specific tags')
  .option('-f, --force', 'Overwrite existing generated files')
  .action(async (source: string, options: { out: string; tag?: string[]; force?: boolean }) => {
    try {
      const outDir = options.out;
      console.log(`\n📄 Importing OpenAPI document: ${source}\n`);

      console.log('  Parsing and generating...');
      const result = await runOpenApiImport({
        outDir,
        source,
        tags: options.tag,
        force: options.force,
      });
      console.log(`  ✓ ${result.apiTitle} v${result.apiVersion}`);
      console.log(`  ✓ Found ${result.endpointCount} endpoints`);
      console.log(`  ✓ Output directory: ${result.outDir}`);
      console.log(
        `  ✓ Groups: ${result.groups.map((group) => `${group.name}(${group.endpoints})`).join(', ')}\n`,
      );

      console.log(`\n✅ Generated ${result.generatedFiles.length} test file(s)`);
      console.log('\nNext steps:');
      console.log('  1. Review generated files in', options.out);
      console.log('  2. If needed, scaffold local config with: omni-qa init');
      console.log('  3. Configure omni-qa.config.ts (environment, auth)');
      console.log('  4. Run tests: omni-qa run --env dev\n');
    } catch (err) {
      console.error(
        '\n❌ Import failed:',
        err instanceof Error ? err.message : err
      );
      process.exit(1);
    }
  });
