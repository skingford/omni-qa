import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { notFoundError } from '../domain/errors.js';
import type {
  ApiEndpoint,
  ApiSpec,
  EndpointFilter,
  EndpointSelection,
  Job,
  TestCase,
  TestResult,
  TestRun,
} from '../domain/types.js';
import type {
  CaseRepository,
  EndpointRepository,
  JobRepository,
  Repositories,
  RunRepository,
  SelectionRepository,
  SpecRepository,
} from './types.js';

class JsonFile<T> {
  private pending: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string, private readonly fallback: T) {}

  async read(): Promise<T> {
    try {
      const content = await readFile(this.filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return this.fallback;
      }
      throw error;
    }
  }

  async write(value: T): Promise<void> {
    this.pending = this.pending.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
      await rename(tempPath, this.filePath);
    });

    await this.pending;
  }

  async update(mutator: (current: T) => T | Promise<T>): Promise<T> {
    let next!: T;
    this.pending = this.pending.then(async () => {
      const current = await this.read();
      next = await mutator(current);
      await mkdir(dirname(this.filePath), { recursive: true });
      const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, 'utf-8');
      await rename(tempPath, this.filePath);
    });

    await this.pending;
    return next;
  }
}

class JsonSpecRepository implements SpecRepository {
  private readonly file: JsonFile<ApiSpec[]>;

  constructor(dataDir: string) {
    this.file = new JsonFile<ApiSpec[]>(join(dataDir, 'specs.json'), []);
  }

  async save(spec: ApiSpec): Promise<void> {
    await this.file.update((specs) => upsertById(specs, spec));
  }

  async list(): Promise<ApiSpec[]> {
    const specs = await this.file.read();
    return [...specs].sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  }

  async get(id: string): Promise<ApiSpec | undefined> {
    const specs = await this.file.read();
    return specs.find((spec) => spec.id === id);
  }
}

class JsonEndpointRepository implements EndpointRepository {
  constructor(private readonly dataDir: string) {}

  async saveMany(specId: string, endpoints: ApiEndpoint[]): Promise<void> {
    const file = this.file(specId);
    await file.write(endpoints);
  }

  async list(specId: string, filter: EndpointFilter = {}): Promise<ApiEndpoint[]> {
    const endpoints = await this.file(specId).read();
    const filtered = endpoints.filter((endpoint) => matchesEndpointFilter(endpoint, filter));
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? filtered.length;
    return filtered.slice(offset, offset + limit);
  }

  async getMany(specId: string, endpointIds: string[]): Promise<ApiEndpoint[]> {
    const allow = new Set(endpointIds);
    const endpoints = await this.file(specId).read();
    return endpoints.filter((endpoint) => allow.has(endpoint.id));
  }

  private file(specId: string): JsonFile<ApiEndpoint[]> {
    return new JsonFile<ApiEndpoint[]>(join(this.dataDir, 'endpoints', `${specId}.json`), []);
  }
}

class JsonSelectionRepository implements SelectionRepository {
  private readonly file: JsonFile<EndpointSelection[]>;

  constructor(dataDir: string) {
    this.file = new JsonFile<EndpointSelection[]>(join(dataDir, 'selections.json'), []);
  }

  async save(selection: EndpointSelection): Promise<void> {
    await this.file.update((selections) => upsertById(selections, selection));
  }

  async get(id: string): Promise<EndpointSelection | undefined> {
    const selections = await this.file.read();
    return selections.find((selection) => selection.id === id);
  }
}

class JsonJobRepository implements JobRepository {
  private readonly file: JsonFile<Job[]>;

  constructor(dataDir: string) {
    this.file = new JsonFile<Job[]>(join(dataDir, 'jobs.json'), []);
  }

  async save(job: Job): Promise<void> {
    await this.file.update((jobs) => upsertById(jobs, job));
  }

  async get(id: string): Promise<Job | undefined> {
    const jobs = await this.file.read();
    return jobs.find((job) => job.id === id);
  }

  async update(id: string, patch: Partial<Job>): Promise<Job> {
    let updated: Job | undefined;
    await this.file.update((jobs) => {
      updated = jobs.find((job) => job.id === id);
      if (!updated) {
        throw notFoundError(`Job ${id} not found`);
      }
      updated = { ...updated, ...patch, id, updatedAt: new Date().toISOString() };
      return upsertById(jobs, updated);
    });
    return updated!;
  }
}

class JsonCaseRepository implements CaseRepository {
  private readonly file: JsonFile<TestCase[]>;

  constructor(dataDir: string) {
    this.file = new JsonFile<TestCase[]>(join(dataDir, 'test-cases.json'), []);
  }

  async saveMany(cases: TestCase[]): Promise<void> {
    await this.file.update((current) => {
      let next = current;
      for (const testCase of cases) {
        next = upsertById(next, testCase);
      }
      return next;
    });
  }

  async getMany(caseIds: string[]): Promise<TestCase[]> {
    const allow = new Set(caseIds);
    const cases = await this.file.read();
    return cases.filter((testCase) => allow.has(testCase.id));
  }

  async list(filter: { specId?: string; endpointId?: string; selectionId?: string } = {}): Promise<TestCase[]> {
    const cases = await this.file.read();
    return cases.filter((testCase) => {
      if (filter.specId && testCase.specId !== filter.specId) return false;
      if (filter.endpointId && testCase.endpointId !== filter.endpointId) return false;
      if (filter.selectionId && testCase.selectionId !== filter.selectionId) return false;
      return true;
    });
  }
}

class JsonRunRepository implements RunRepository {
  private readonly runs: JsonFile<TestRun[]>;

  constructor(private readonly dataDir: string) {
    this.runs = new JsonFile<TestRun[]>(join(dataDir, 'test-runs.json'), []);
  }

  async save(run: TestRun): Promise<void> {
    await this.runs.update((runs) => upsertById(runs, run));
  }

  async get(id: string): Promise<TestRun | undefined> {
    const runs = await this.runs.read();
    return runs.find((run) => run.id === id);
  }

  async update(id: string, patch: Partial<TestRun>): Promise<TestRun> {
    let updated: TestRun | undefined;
    await this.runs.update((runs) => {
      updated = runs.find((run) => run.id === id);
      if (!updated) {
        throw notFoundError(`Test run ${id} not found`);
      }
      updated = { ...updated, ...patch, id, updatedAt: new Date().toISOString() };
      return upsertById(runs, updated);
    });
    return updated!;
  }

  async saveResults(runId: string, results: TestResult[]): Promise<void> {
    await this.resultsFile(runId).write(results);
  }

  async listResults(runId: string): Promise<TestResult[]> {
    return this.resultsFile(runId).read();
  }

  private resultsFile(runId: string): JsonFile<TestResult[]> {
    return new JsonFile<TestResult[]>(join(this.dataDir, 'results', `${runId}.json`), []);
  }
}

export function createJsonRepositories(dataDir: string): Repositories {
  return {
    specs: new JsonSpecRepository(dataDir),
    endpoints: new JsonEndpointRepository(dataDir),
    selections: new JsonSelectionRepository(dataDir),
    jobs: new JsonJobRepository(dataDir),
    cases: new JsonCaseRepository(dataDir),
    runs: new JsonRunRepository(dataDir),
  };
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const next = items.slice();
  const index = next.findIndex((candidate) => candidate.id === item.id);
  if (index === -1) {
    next.push(item);
  } else {
    next[index] = item;
  }
  return next;
}

function matchesEndpointFilter(endpoint: ApiEndpoint, filter: EndpointFilter): boolean {
  if (filter.methods?.length && !filter.methods.includes(endpoint.method)) {
    return false;
  }

  if (filter.tags?.length && !filter.tags.some((tag) => endpoint.tags.includes(tag))) {
    return false;
  }

  if (filter.path && !endpoint.path.includes(filter.path)) {
    return false;
  }

  if (filter.operationId && endpoint.operationId !== filter.operationId) {
    return false;
  }

  if (filter.keyword) {
    const keyword = filter.keyword.toLowerCase();
    const haystack = [
      endpoint.path,
      endpoint.operationId ?? '',
      endpoint.summary ?? '',
      endpoint.description ?? '',
      endpoint.method,
      ...endpoint.tags,
    ].join(' ').toLowerCase();

    if (!haystack.includes(keyword)) {
      return false;
    }
  }

  return true;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
