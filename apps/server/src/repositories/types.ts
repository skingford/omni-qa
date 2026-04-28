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

export interface SpecRepository {
  save(spec: ApiSpec): Promise<void>;
  list(): Promise<ApiSpec[]>;
  get(id: string): Promise<ApiSpec | undefined>;
}

export interface EndpointRepository {
  saveMany(specId: string, endpoints: ApiEndpoint[]): Promise<void>;
  list(specId: string, filter?: EndpointFilter): Promise<ApiEndpoint[]>;
  getMany(specId: string, endpointIds: string[]): Promise<ApiEndpoint[]>;
}

export interface SelectionRepository {
  save(selection: EndpointSelection): Promise<void>;
  get(id: string): Promise<EndpointSelection | undefined>;
}

export interface JobRepository {
  save(job: Job): Promise<void>;
  get(id: string): Promise<Job | undefined>;
  update(id: string, patch: Partial<Job>): Promise<Job>;
}

export interface CaseRepository {
  saveMany(cases: TestCase[]): Promise<void>;
  getMany(caseIds: string[]): Promise<TestCase[]>;
  list(filter?: { specId?: string; endpointId?: string; selectionId?: string }): Promise<TestCase[]>;
}

export interface RunRepository {
  save(run: TestRun): Promise<void>;
  get(id: string): Promise<TestRun | undefined>;
  update(id: string, patch: Partial<TestRun>): Promise<TestRun>;
  saveResults(runId: string, results: TestResult[]): Promise<void>;
  listResults(runId: string): Promise<TestResult[]>;
}

export interface Repositories {
  specs: SpecRepository;
  endpoints: EndpointRepository;
  selections: SelectionRepository;
  jobs: JobRepository;
  cases: CaseRepository;
  runs: RunRepository;
}
