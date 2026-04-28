import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadServerConfig } from '../config.js';
import { createJsonRepositories } from '../repositories/json-store.js';
import { TestExecutionService } from '../services/execution-service.js';
import { TestCaseGenerationService } from '../services/generation-service.js';
import { OpenApiCatalogService } from '../services/import-service.js';

const PETSTORE_OPENAPI_URL = 'https://petstore3.swagger.io/api/v3/openapi.json';

async function main(): Promise<void> {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
  process.chdir(repoRoot);

  const config = loadServerConfig();
  const repos = createJsonRepositories(config.dataDir);
  const catalog = new OpenApiCatalogService(repos, config);
  const generation = new TestCaseGenerationService(repos, config);
  const execution = new TestExecutionService(repos, config);

  console.log(`Importing ${PETSTORE_OPENAPI_URL}`);
  const importJob = (await catalog.startImport(PETSTORE_OPENAPI_URL)).job;
  const imported = await waitForJob(catalog, importJob.id);
  if (imported.status !== 'succeeded') {
    throw new Error(imported.error ?? 'Petstore import failed');
  }

  const specId = String(imported.result?.specId ?? '');
  const endpoints = await catalog.listEndpoints(specId, { methods: ['GET'], keyword: '/pet/findByStatus', limit: 1 });
  if (endpoints.length === 0) {
    throw new Error('Petstore smoke found no GET endpoints');
  }

  const selection = await catalog.createSelection({
    specId,
    endpointIds: [endpoints[0]!.id],
    name: 'Petstore smoke',
  });

  console.log(`Generating fallback case for ${endpoints[0]!.method} ${endpoints[0]!.path}`);
  const generationJob = (await generation.startGeneration({ selectionId: selection.id })).job;
  const generated = await waitForJob(catalog, generationJob.id);
  if (generated.status !== 'succeeded') {
    throw new Error(generated.error ?? 'Petstore case generation failed');
  }

  const cases = (await generation.listCases({ selectionId: selection.id })).map((testCase) => ({
    ...testCase,
    assertions: [{ type: 'status' as const, operator: 'lt' as const, expected: 600 }],
  }));
  if (cases.length === 0) {
    throw new Error('Petstore smoke generated no cases');
  }
  await repos.cases.saveMany(cases);

  console.log(`Running ${cases.length} generated case(s)`);
  const { run } = await execution.startRun({
    caseIds: cases.map((testCase) => testCase.id),
    envId: process.env.OMNI_ENV ?? 'dev',
    workers: 1,
  });

  const finished = await waitForRun(execution, run.id);
  console.log(`Run ${finished.status}: ${finished.passed}/${finished.total} passed`);
  console.log(finished.report?.htmlReportDir ?? 'No HTML report path');

  if (finished.status !== 'succeeded') {
    throw new Error(finished.error ?? 'Petstore smoke run failed');
  }
}

async function waitForJob(catalog: OpenApiCatalogService, jobId: string) {
  while (true) {
    const job = await catalog.getJob(jobId);
    if (job.status !== 'pending' && job.status !== 'running') {
      return job;
    }
    await sleep(500);
  }
}

async function waitForRun(execution: TestExecutionService, runId: string) {
  while (true) {
    const run = await execution.getRun(runId);
    if (run.status !== 'pending' && run.status !== 'running') {
      return run;
    }
    await sleep(800);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
