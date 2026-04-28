import { useEffect, useState, type ReactNode } from 'react'

type ViewId = 'dashboard' | 'api' | 'logic' | 'results'

type NavItem = {
  id: ViewId
  label: string
  icon: string
}

type Navigate = (view: ViewId) => void

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'api', label: 'API Inventory', icon: 'api' },
  { id: 'logic', label: 'Logic Editor', icon: 'code' },
  { id: 'results', label: 'Terminal', icon: 'terminal' },
]

const metricCards = [
  {
    label: 'Total Endpoints',
    value: '1,248',
    detail: '+12 this week',
    icon: 'route',
    tone: 'success',
  },
  {
    label: 'Active Tests',
    value: '342',
    detail: 'Running normally',
    icon: 'science',
    tone: 'muted',
  },
  {
    label: 'Error Rate',
    value: '0.04%',
    detail: '-0.01% since yesterday',
    icon: 'warning',
    tone: 'danger',
  },
]

const specs = [
  ['Payment Gateway API', 'v1.4.2', '42', 'Synced', 'success'],
  ['User Identity Service', 'v2.0.0-rc', '18', 'Syncing', 'primary'],
  ['Inventory Catalog', 'v3.1.0', '156', 'Synced', 'success'],
  ['Legacy Auth (Deprecated)', 'v0.9.8', '12', 'Archived', 'muted'],
] as const

const jobs = [
  ['COMPLETED', 'Test Suite: Payment Flow', 'Run ID: #88492', '2m ago', 'success', 0],
  ['RUNNING (65%)', 'Spec Import: User Identity', 'Parsing schemas...', 'Just now', 'primary', 65],
  ['FAILED', 'Fuzz Test: Catalog API', 'Error: 502 Bad Gateway on /items', '15m ago', 'danger', 0],
  ['COMPLETED', 'Daily Regression Suite', 'Passed 412/412 assertions', '1h ago', 'success', 0],
] as const

const endpointGroups = [
  {
    path: '/v1/authentication',
    total: '2 ENDPOINTS',
    endpoints: [
      ['POST', '/login', 'Authenticate user session', true],
      ['POST', '/refresh', 'Refresh JWT token', false],
    ],
  },
  {
    path: '/v1/workspaces',
    total: '4 ENDPOINTS',
    endpoints: [
      ['GET', '/list', 'Retrieve user workspaces', true],
      ['POST', '/create', 'Initialize new workspace', true],
      ['GET', '/{id}/details', 'Get specific workspace data', false],
      ['DEL', '/{id}/delete', 'Remove workspace', false],
    ],
  },
] as const

const selectedEndpoints = [
  ['POST', '/v1/authentication/login', 'Target: Critical path coverage'],
  ['GET', '/v1/workspaces/list', 'Target: Read validation'],
  ['POST', '/v1/workspaces/create', 'Target: State mutation handling'],
] as const

const resultRows = [
  ['POST', '/api/v2/auth/verify_token', '412ms', 'FAILED', true],
  ['POST', '/api/v2/users/me/profile', '285ms', 'FAILED', true],
  ['GET', '/api/v2/inventory/list', '89ms', 'PASSED', false],
  ['PUT', '/api/v2/settings/update', '156ms', 'PASSED', false],
  ['GET', '/api/v2/health/check', '22ms', 'PASSED', false],
] as const

const codeHtml = `{
  <span class="token-key">"test_suite"</span>: {
    <span class="token-key">"id"</span>: <span class="token-string">"AUTH-001"</span>,
    <span class="token-key">"name"</span>: <span class="token-string">"Primary Login Flow Validation"</span>,
    <span class="token-key">"strict_mode"</span>: <span class="token-bool">true</span>,
    <span class="token-key">"steps"</span>: [
      {
        <span class="token-key">"step_id"</span>: <span class="token-string">"req_token_exchange"</span>,
        <span class="token-key">"method"</span>: <span class="token-string">"POST"</span>,
        <span class="token-key">"endpoint"</span>: <span class="token-string">"/api/v2/auth/token"</span>,
        <span class="token-key">"headers"</span>: {
          <span class="token-key">"Content-Type"</span>: <span class="token-string">"application/json"</span>,
          <span class="token-key">"X-Client-ID"</span>: <span class="token-string">"{{env.CLIENT_ID}}"</span>
        },
        <span class="token-key">"payload"</span>: {
          <span class="token-key">"username"</span>: <span class="token-string">"test_admin@apicore.os"</span>,
          <span class="token-key">"password"</span>: <span class="token-string">"{{secret.ADMIN_PASS}}"</span>
        },
        <span class="token-key">"assertions"</span>: [
          { <span class="token-key">"type"</span>: <span class="token-string">"status_code"</span>, <span class="token-key">"value"</span>: <span class="token-bool">200</span> },
          { <span class="token-key">"type"</span>: <span class="token-string">"json_path"</span>, <span class="token-key">"path"</span>: <span class="token-string">"$.access_token"</span>, <span class="token-key">"condition"</span>: <span class="token-string">"exists"</span> }
        ]
      }
    ]
  }
}`

const validViews = new Set<ViewId>(['dashboard', 'api', 'logic', 'results'])

function getInitialView(): ViewId {
  const value = window.location.hash.replace('#', '') as ViewId
  return validViews.has(value) ? value : 'dashboard'
}

function App() {
  const [view, setView] = useState<ViewId>(getInitialView)

  useEffect(() => {
    const syncHash = () => setView(getInitialView())
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [])

  const navigate: Navigate = (nextView) => {
    setView(nextView)
    window.history.replaceState(null, '', `#${nextView}`)
  }

  if (view === 'dashboard') {
    return <DashboardScreen activeView={view} onNavigate={navigate} />
  }

  return (
    <WorkbenchShell activeView={view} onNavigate={navigate}>
      {view === 'api' && <ApiExplorerView />}
      {view === 'logic' && <LogicEditorView />}
      {view === 'results' && <ExecutionResultsView />}
    </WorkbenchShell>
  )
}

function Icon({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
    >
      {name}
    </span>
  )
}

function SideNav({
  activeView,
  onNavigate,
  className = '',
}: {
  activeView: ViewId
  onNavigate: Navigate
  className?: string
}) {
  return (
    <aside className={`side-nav ${className}`}>
      <div className="side-brand">
        <div className="brand-mark">
          <Icon name={activeView === 'api' ? 'hexagon' : 'terminal'} fill={activeView === 'api'} />
        </div>
        <div>
          <div className="project-name">PROJECT_NEON</div>
          <div className="project-version">V2.0.4-STABLE</div>
        </div>
      </div>
      <button className="new-request" onClick={() => onNavigate('api')} type="button">
        <Icon name="add" />
        New Request
      </button>
      <nav className="nav-list" aria-label="Primary">
        {navItems.map((item) => (
          <a
            key={item.id}
            className={`nav-link ${activeView === item.id ? 'active' : ''}`}
            href={`#${item.id}`}
            onClick={(event) => {
              event.preventDefault()
              onNavigate(item.id)
            }}
          >
            <Icon name={item.icon} fill={activeView === item.id} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
      <div className="nav-footer">
        <a className="nav-link small" href="#docs">
          <Icon name="description" />
          <span>Docs</span>
        </a>
        <a className="nav-link small" href="#status">
          <Icon name="analytics" />
          <span>Status</span>
        </a>
      </div>
    </aside>
  )
}

function TopBar({
  onNavigate,
  dashboard = false,
}: {
  onNavigate: Navigate
  dashboard?: boolean
}) {
  return (
    <header className={`top-bar ${dashboard ? 'dashboard-top' : ''}`}>
      <div className="top-left">
        <div className="logo">APICORE_OS</div>
        <label className={`search-box ${dashboard ? 'wide' : ''}`}>
          <Icon name="search" />
          <input placeholder={dashboard ? 'Search API inventory...' : 'Search resources...'} />
        </label>
      </div>
      <div className="top-actions">
        <button className="btn ghost" type="button">
          <Icon name="upload_file" />
          Import Spec
        </button>
        <button className="btn primary" onClick={() => onNavigate('results')} type="button">
          <Icon name="play_arrow" fill />
          Execute Test
        </button>
        <div className="top-divider" />
        <button aria-label="Notifications" className="icon-button" type="button">
          <Icon name="notifications" />
        </button>
        <button aria-label="Settings" className="icon-button" type="button">
          <Icon name="settings" />
        </button>
        <div className="avatar">
          <Icon name="person" fill />
        </div>
      </div>
    </header>
  )
}

function DashboardScreen({ activeView, onNavigate }: { activeView: ViewId; onNavigate: Navigate }) {
  return (
    <div className="screen dashboard-screen">
      <TopBar dashboard onNavigate={onNavigate} />
      <div className="dashboard-layout">
        <SideNav activeView={activeView} className="below-top" onNavigate={onNavigate} />
        <main className="dashboard-main">
          <section className="page-title compact">
            <h1>Dashboard Overview</h1>
            <p>System status and API specification management.</p>
          </section>
          <section className="metrics three">
            {metricCards.map((metric) => (
              <article className="metric-card" key={metric.label}>
                <div className="metric-head">
                  <span>{metric.label}</span>
                  <Icon className={`tone-${metric.tone}`} name={metric.icon} />
                </div>
                <strong>{metric.value}</strong>
                <small className={`tone-${metric.tone}`}>{metric.detail}</small>
              </article>
            ))}
          </section>
          <section className="dashboard-work">
            <QuickImport />
            <ManagedSpecs />
          </section>
        </main>
        <RecentJobs />
      </div>
    </div>
  )
}

function QuickImport() {
  return (
    <article className="panel quick-import">
      <div className="panel-title">
        <Icon name="upload_file" />
        <h2>Quick Import</h2>
      </div>
      <div className="drop-zone">
        <Icon className="big-icon" name="cloud_upload" />
        <strong>Drag & Drop OpenAPI Spec</strong>
        <span>Supports .json, .yaml, .yml (OAS 3.0+)</span>
        <div className="or-line">
          <i />
          <em>OR</em>
          <i />
        </div>
        <input placeholder="Paste URL..." />
      </div>
    </article>
  )
}

function ManagedSpecs() {
  return (
    <article className="panel managed-specs">
      <div className="panel-title split">
        <div>
          <Icon name="list_alt" />
          <h2>Managed Specifications</h2>
        </div>
        <button type="button">
          View All
          <Icon name="arrow_forward" />
        </button>
      </div>
      <div className="table-scroll">
        <table className="spec-table">
          <thead>
            <tr>
              <th>Spec Name</th>
              <th>Version</th>
              <th>Endpoints</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {specs.map(([name, version, endpoints, status, tone]) => (
              <tr key={name}>
                <td>
                  <span className="spec-name-cell">
                    <Icon name={tone === 'muted' ? 'error' : 'description'} />
                    {name}
                  </span>
                </td>
                <td>
                  <span className="version-pill">{version}</span>
                </td>
                <td>{endpoints}</td>
                <td>
                  <span className={`status-text tone-${tone}`}>
                    <i className={`status-dot tone-fill-${tone}`} />
                    {status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}

function RecentJobs() {
  return (
    <aside className="recent-jobs">
      <div className="recent-title">
        <h2>
          <Icon name="history" />
          Recent Jobs
        </h2>
        <span>Live</span>
      </div>
      <div className="job-list">
        {jobs.map(([state, title, detail, time, tone, progress]) => (
          <article className={`job-card tone-border-${tone}`} key={`${state}-${title}`}>
            {progress > 0 && <i className="progress" style={{ width: `${progress}%` }} />}
            <div className="job-meta">
              <span className={`job-state tone-${tone}`}>
                <Icon name={tone === 'success' ? 'check_circle' : tone === 'danger' ? 'cancel' : 'autorenew'} />
                {state}
              </span>
              <small>{time}</small>
            </div>
            <strong>{title}</strong>
            <code>{detail}</code>
          </article>
        ))}
      </div>
    </aside>
  )
}

function WorkbenchShell({
  activeView,
  onNavigate,
  children,
}: {
  activeView: ViewId
  onNavigate: Navigate
  children: ReactNode
}) {
  return (
    <div className="screen workbench-screen">
      <SideNav activeView={activeView} onNavigate={onNavigate} />
      <div className="workbench">
        <TopBar onNavigate={onNavigate} />
        {children}
      </div>
    </div>
  )
}

function ApiExplorerView() {
  return (
    <main className="workspace api-view">
      <div className="workspace-title">
        <div>
          <h1>API Explorer</h1>
          <p>Select endpoints to construct a targeted testing suite.</p>
        </div>
        <span className="health-pill">
          <i />
          API STATUS: GREEN
        </span>
      </div>
      <div className="api-grid">
        <section className="panel endpoint-panel">
          <div className="endpoint-toolbar">
            <div>
              <button type="button">
                <Icon name="unfold_more" />
                Expand All
              </button>
              <button type="button">
                <Icon name="unfold_less" />
                Collapse All
              </button>
            </div>
            <div className="method-filter">
              <span>FILTER:</span>
              <MethodTag method="GET" />
              <MethodTag method="POST" />
              <MethodTag method="ALL" />
            </div>
          </div>
          <div className="endpoint-groups">
            {endpointGroups.map((group) => (
              <article className="endpoint-group" key={group.path}>
                <header>
                  <Icon name="folder_open" />
                  <strong>{group.path}</strong>
                  <span>{group.total}</span>
                </header>
                {group.endpoints.map(([method, path, description, checked]) => (
                  <label className="endpoint-row" key={`${method}-${path}`}>
                    <input defaultChecked={checked} type="checkbox" />
                    <MethodTag method={method} />
                    <strong>{path}</strong>
                    <span>{description}</span>
                  </label>
                ))}
              </article>
            ))}
          </div>
        </section>
        <aside className="panel selection-panel">
          <div className="selection-title">
            <h2>Test Suite Selection</h2>
            <strong>{selectedEndpoints.length}</strong>
          </div>
          <div className="selection-list">
            {selectedEndpoints.map(([method, path, detail]) => (
              <article className="selection-card" key={path}>
                <Icon className={`method-icon method-${method.toLowerCase()}`} name="api" />
                <div>
                  <div>
                    <span className={`method-inline method-${method.toLowerCase()}`}>{method}</span>
                    <strong>{path}</strong>
                  </div>
                  <p>{detail}</p>
                </div>
                <button aria-label={`Remove ${path}`} className="card-icon-action" type="button">
                  <Icon name="close" />
                </button>
              </article>
            ))}
          </div>
          <div className="selection-footer">
            <div>
              <span>EST. GENERATION TIME:</span>
              <strong>~45 SEC</strong>
            </div>
            <button type="button">
              <Icon name="auto_awesome" />
              Generate AI Test Cases
            </button>
          </div>
        </aside>
      </div>
    </main>
  )
}

function MethodTag({ method }: { method: string }) {
  return <span className={`method-tag method-${method.toLowerCase()}`}>{method}</span>
}

function LogicEditorView() {
  return (
    <main className="logic-canvas">
      <section className="file-tree">
        <div className="file-tree-title">
          <h2>Test Explorer</h2>
          <div>
            <button aria-label="Create folder" className="tree-action" type="button">
              <Icon name="create_new_folder" />
            </button>
            <button aria-label="Create test file" className="tree-action" type="button">
              <Icon name="note_add" />
            </button>
          </div>
        </div>
        <div className="tree-body">
          <TreeFolder open label="Authentication" />
          <div className="tree-files">
            <TreeFile active label="login_flow.test.json" />
            <TreeFile label="oauth_refresh.test.json" />
          </div>
          <TreeFolder label="Payment_Gateway" />
          <TreeFolder label="User_Profiles" />
        </div>
      </section>
      <section className="editor">
        <div className="editor-bar">
          <span>Authentication</span>
          <Icon name="chevron_right" />
          <strong>
            <Icon name="data_object" />
            login_flow.test.json
          </strong>
          <em>
            <i />
            Valid JSON
          </em>
        </div>
        <div className="code-editor">
          <div className="line-numbers">
            {Array.from({ length: 26 }, (_, index) => (
              <span key={index + 1}>{index + 1}</span>
            ))}
          </div>
          <pre className="code-pre" dangerouslySetInnerHTML={{ __html: codeHtml }} />
        </div>
      </section>
      <aside className="config-panel">
        <div className="config-title">
          <h2>Configuration</h2>
          <Icon name="tune" />
        </div>
        <div className="config-body">
          <label className="field-block">
            <span>Target Environment</span>
            <select defaultValue="STAGING_V2 (us-east-1)">
              <option>STAGING_V2 (us-east-1)</option>
              <option>PRODUCTION (us-west-2)</option>
              <option>LOCAL_DEV (localhost:8080)</option>
            </select>
          </label>
          <div className="field-block with-divider">
            <span>Execution Flags</span>
            <label className="check-row">
              <input defaultChecked type="checkbox" />
              Strict TLS Validation
            </label>
            <label className="check-row">
              <input type="checkbox" />
              Capture Response Body
            </label>
          </div>
          <div className="field-block with-divider">
            <div className="field-head">
              <span>Context Variables</span>
              <button type="button">+ Add</button>
            </div>
            <VarRow name="CLIENT_ID" value="app_dev_994a" />
            <VarRow name="TIMEOUT_MS" value="5000" />
          </div>
        </div>
      </aside>
    </main>
  )
}

function TreeFolder({ label, open = false }: { label: string; open?: boolean }) {
  return (
    <div className="tree-row folder">
      <Icon name={open ? 'keyboard_arrow_down' : 'keyboard_arrow_right'} />
      <Icon name="folder" />
      <span>{label}</span>
    </div>
  )
}

function TreeFile({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div className={`tree-row file ${active ? 'active' : ''}`}>
      <Icon name="data_object" />
      <span>{label}</span>
    </div>
  )
}

function VarRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="var-row">
      <input readOnly value={name} />
      <input readOnly value={value} />
      <button aria-label={`Remove ${name}`} className="var-remove" type="button">
        <Icon name="close" />
      </button>
    </div>
  )
}

function ExecutionResultsView() {
  return (
    <main className="workspace results-view">
      <div className="results-title">
        <div>
          <div className="run-line">
            <span>RUN-ID: 892-ALPHA</span>
            <em>14:02:45 UTC</em>
          </div>
          <h1>Test Execution Results</h1>
        </div>
        <button type="button">
          <Icon name="download" />
          Export Report
        </button>
      </div>
      <section className="metrics four">
        <ResultMetric label="Total Requests" value="245" />
        <ResultMetric label="Passed" tone="success" value="238" />
        <ResultMetric label="Failed" tone="danger" value="7" />
        <ResultMetric label="Avg Latency" suffix="ms" value="142" />
      </section>
      <section className="results-grid">
        <article className="panel trace-panel">
          <div className="trace-title">
            <h2>Execution Trace</h2>
            <span>
              <Icon name="filter_list" />
              Filter: Failed Only
            </span>
          </div>
          <div className="trace-scroll">
            <table className="trace-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>Latency</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {resultRows.map(([method, endpoint, latency, status, failed]) => (
                  <tr className={failed ? 'failed-row' : ''} key={endpoint}>
                    <td>
                      <MethodTag method={method} />
                    </td>
                    <td>{endpoint}</td>
                    <td>{latency}</td>
                    <td>
                      <strong className={failed ? 'tone-danger' : 'tone-success'}>{status}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <aside className="panel ai-panel">
          <div className="ai-title">
            <Icon name="auto_awesome" />
            <h2>AI Failure Analysis</h2>
          </div>
          <div className="ai-body">
            <p>
              <strong>Pattern Detected:</strong> 5 out of 7 failures exhibit identical behavior related to JWT
              validation. The API endpoints successfully receive the payload but reject the Authorization header with a{' '}
              <code>401 Unauthorized</code> status.
            </p>
            <div className="root-cause">
              <span>Likely Root Cause</span>
              <p>
                The <code>verify_token</code> middleware appears to be strictly enforcing a new claim{' '}
                <code>"scope": "read:write"</code> which is absent from the generated test tokens in Environment{' '}
                <strong>ALPHA</strong>.
              </p>
            </div>
            <div className="response-fragment">
              <span>Suggested Fix (Raw Response Fragment):</span>
              <pre>{`{
  "error": "Invalid Token Scope",
  "code": 401,
  "details": {
    "missing_claim": "scope",
    "required": ["read:write"]
  }
}`}</pre>
            </div>
            <button type="button">Auto-Patch Environment Variables</button>
          </div>
        </aside>
      </section>
    </main>
  )
}

function ResultMetric({
  label,
  value,
  suffix,
  tone = 'neutral',
}: {
  label: string
  value: string
  suffix?: string
  tone?: 'neutral' | 'success' | 'danger'
}) {
  return (
    <article className={`result-metric tone-border-${tone}`}>
      <span>{label}</span>
      <strong className={`tone-${tone}`}>
        {value}
        {suffix && <small>{suffix}</small>}
      </strong>
    </article>
  )
}

export default App
