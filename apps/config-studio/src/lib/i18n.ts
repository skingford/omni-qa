import { ref, watch } from 'vue'

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

type MessageTree = {
  [key: string]: string | MessageTree
}

const DEFAULT_LOCALE: Locale = 'zh-CN'
const LOCALE_STORAGE_KEY = 'omni-qa.config-studio.locale'

const messages: Record<Locale, MessageTree> = {
  'zh-CN': {
    page: {
      documentTitle: 'omni-qa 配置工作台',
    },
    language: {
      label: '界面语言',
      zhCN: '简体中文',
      enUS: 'English',
    },
    common: {
      loading: '加载中...',
      output: '输出',
      envFallback: '环境',
      remove: '移除',
      files: '文件',
      folders: '目录',
      optional: '可选项',
      outputDirectory: '输出目录',
      generated: '已生成',
      fileCount: '{count} 个文件',
      groups: '分组',
      reportDirectory: '报告目录',
    },
    hero: {
      title: 'omni-qa 配置工作台',
      description:
        '用这个页面快速初始化或编辑环境、鉴权流程、通知配置与密钥占位，不用再手动改多个文件。',
      configFile: '配置文件',
      envFile: '环境变量文件',
    },
    actions: {
      reload: '从磁盘重新加载',
      createProject: '创建初始化项目',
      creatingProject: '正在创建项目...',
      saveConfig: '保存配置',
      saving: '正在保存...',
    },
    status: {
      requestFailed: '请求失败。',
      reloading: '正在从磁盘重新加载配置...',
      loadingStudio: '正在加载配置工作台...',
      noConfig: '暂未检测到配置。请选择一个起始方案并创建项目文件。',
      configLoaded: '配置已加载，可以继续调整表单并在准备好后保存。',
      creatingStarter: '正在创建初始化项目文件...',
      starterCreated: '初始化文件已创建完成。现在可以继续在下方微调并随时保存。',
      savingConfig: '正在保存配置...',
      saved: '已保存，配置文件和 .env 已同步到磁盘。',
      importSourceRequired: '请先输入 OpenAPI 地址或本地文件路径。',
      importOutDirRequired: '请选择生成测试文件的输出目录。',
      importing: '正在导入 OpenAPI 文档并生成测试...',
      imported: '已导入 {title}，共生成 {count} 个测试文件。',
      startingRun: '正在启动 Playwright 运行...',
      runStarted: 'Playwright 已启动，正在实时输出日志...',
      stoppingRun: '正在停止 Playwright 运行...',
      runCancelled: '测试运行已取消。',
      runSucceeded: '测试运行完成。',
      runFailed: '测试运行结束，退出码为 {exitCode}。',
    },
    run: {
      liveInProgress: '运行中',
      latestCancelled: '最近一次运行已取消',
      latestPassed: '最近一次运行通过',
      latestFailed: '最近一次运行失败',
      section: '运行',
      title: '执行测试并查看报告',
      environment: '环境',
      tagFilter: '标签过滤',
      retries: '重试次数',
      workers: '并发数',
      trace: 'Trace',
      traceHint: '为本次运行设置 <code>TRACE=on</code>。',
      headed: '有头模式',
      headedHint: '调试时启用浏览器可视模式。',
      runButton: '运行 Playwright 测试',
      runningButton: '正在实时输出...',
      stopButton: '停止当前运行',
      stoppingButton: '正在停止运行...',
      openReport: '打开最新 HTML 报告',
      exit: '退出码',
      liveOutput: '实时输出',
    },
    bootstrap: {
      section: '初始化',
      title: '创建你的第一个 omni-qa 工作区文件',
      description: '选择一个合理的起点，生成文件后再继续在编辑器里细调。',
      defaultEnvironment: '默认环境',
      baseUrl: '基础地址',
      authScaffold: '鉴权脚手架',
      authScaffoldHint: '这里会决定初始化时生成哪些鉴权字段和 .env 占位变量。',
      noAuth: '无鉴权',
      staticAuthHeaders: '静态鉴权请求头',
      loginBearer: '登录并获取 Bearer Token',
      includeDingtalk: '包含钉钉通知',
      includeDingtalkHint: '生成 webhook 通知配置块与对应占位变量。',
      includeEmail: '包含邮件通知',
      includeEmailHint: '生成 SMTP 通知配置和 .env 占位变量。',
      createEnvFile: '创建本地 .env',
      createEnvFileHint: '如果你只想先生成 `.env.example`，可以先取消勾选。',
      preview: '预览',
      previewTitle: '工作台将会创建',
      createsEnv: '如果缺失，也会一并创建 <code>.env</code>。',
      skipsEnv: '暂时跳过 <code>.env</code> 的创建。',
      then: '接下来',
      nextCommands: '下一步命令',
    },
    general: {
      section: '通用',
      title: '项目默认配置',
      description: '设置主环境以及测试目录和报告目录。',
      defaultEnvironment: '默认环境',
      testDirectory: '测试目录',
      reportDirectory: '报告目录',
      globalHeaders: '全局请求头',
      globalHeadersHint:
        '每行一个请求头，支持 <code>key=value</code> 或 <code>key: value</code> 两种写法。',
      envVars: '环境变量（.env）',
      envVarsHint:
        '这里的值会写入 <code>.env</code>。敏感信息建议通过配置引用，不要直接硬编码。',
    },
    environments: {
      section: '环境',
      title: '目标环境与鉴权',
      description: '每个环境都可以拥有独立的基础地址、请求头和鉴权流程。',
      add: '新增环境',
      empty: '还没有环境配置。新增一个环境后，omni-qa 才能指向目标 API。',
    },
    notifications: {
      section: '通知',
      title: '测试运行后的告警',
      description: '接入钉钉或邮件通道，用于自动推送测试结果。',
      add: '新增通知',
      empty: '还没有配置通知通道。需要推送告警时可以添加钉钉或邮件。',
    },
    import: {
      section: '导入',
      title: '从 OpenAPI 生成测试',
      source: '来源 URL 或文件路径',
      outDir: '输出目录',
      filterTags: '筛选标签',
      filterTagsHint: '可选。多个标签用逗号或换行分隔。',
      overwrite: '覆盖已生成文件',
      overwriteHint: '如果需要重新生成已存在的文件，请开启这个选项。',
      importButton: '导入并生成测试',
      importingButton: '正在生成测试...',
    },
    result: {
      endpoints: '{count} 个接口',
    },
    environmentCard: {
      title: '环境 #{index}',
      description: '为每个目标环境设置一个稳定且简短的名称，例如 dev 或 staging。',
      name: '名称',
      baseUrl: '基础地址',
      headers: '环境请求头',
      auth: '鉴权方式',
      none: '无',
      staticHeaders: '静态请求头',
      loginBearer: '登录并获取 Bearer Token',
      authHeaders: '鉴权请求头',
      loginUrl: '登录地址',
      method: '请求方法',
      tokenPath: 'Token 路径',
      loginBody: '登录请求体',
      noAuthHint: '当前未配置鉴权，请求只会携带全局请求头和环境请求头。',
    },
    notificationCard: {
      title: '通知 #{index}',
      description: '将精简的运行摘要推送给合适的接收人。',
      type: '类型',
      dingtalk: '钉钉',
      email: '邮件',
      webhook: 'Webhook',
      recipients: '收件人',
      smtpHost: 'SMTP 主机',
      smtpPort: 'SMTP 端口',
      secure: '安全连接',
      smtpUser: 'SMTP 用户',
      smtpPassword: 'SMTP 密码',
    },
    runbook: {
      section: '操作手册',
      title: '下一步命令',
      footer: '提示：工作台运行期间请保持这个终端开启，按 Ctrl+C 可以停止本地服务。',
    },
  },
  'en-US': {
    page: {
      documentTitle: 'omni-qa config studio',
    },
    language: {
      label: 'Language',
      zhCN: '简体中文',
      enUS: 'English',
    },
    common: {
      loading: 'Loading...',
      output: 'Output',
      envFallback: 'env',
      remove: 'Remove',
      files: 'Files',
      folders: 'Folders',
      optional: 'Optional',
      outputDirectory: 'Output',
      generated: 'Generated',
      fileCount: '{count} file(s)',
      groups: 'Groups',
      reportDirectory: 'Report directory',
    },
    hero: {
      title: 'omni-qa config studio',
      description:
        'Use this page to bootstrap or edit environments, auth flows, notifications, and secret placeholders without hand-editing multiple files.',
      configFile: 'Config file',
      envFile: 'Env file',
    },
    actions: {
      reload: 'Reload from disk',
      createProject: 'Create starter project',
      creatingProject: 'Creating project...',
      saveConfig: 'Save configuration',
      saving: 'Saving...',
    },
    status: {
      requestFailed: 'Request failed.',
      reloading: 'Reloading configuration from disk...',
      loadingStudio: 'Loading configuration studio...',
      noConfig: 'No config detected yet. Choose a starter setup and create the project files.',
      configLoaded: 'Configuration loaded. Adjust the form and save when ready.',
      creatingStarter: 'Creating starter project files...',
      starterCreated: 'Starter files created. You can fine-tune them below and save anytime.',
      savingConfig: 'Saving configuration...',
      saved: 'Saved. Config and .env are updated on disk.',
      importSourceRequired: 'Enter an OpenAPI URL or local file path before importing.',
      importOutDirRequired: 'Choose where generated test files should be written.',
      importing: 'Importing OpenAPI document and generating tests...',
      imported: 'Imported {title} and generated {count} test file(s).',
      startingRun: 'Starting Playwright run...',
      runStarted: 'Playwright run started. Streaming live output...',
      stoppingRun: 'Stopping Playwright run...',
      runCancelled: 'Test run cancelled.',
      runSucceeded: 'Test run finished successfully.',
      runFailed: 'Test run finished with exit code {exitCode}.',
    },
    run: {
      liveInProgress: 'Live run in progress',
      latestCancelled: 'Latest run was cancelled',
      latestPassed: 'Latest run passed',
      latestFailed: 'Latest run finished with failures',
      section: 'Run',
      title: 'Execute tests and inspect the report',
      environment: 'Environment',
      tagFilter: 'Tag filter',
      retries: 'Retries',
      workers: 'Workers',
      trace: 'Trace',
      traceHint: 'Set <code>TRACE=on</code> for this run.',
      headed: 'Headed',
      headedHint: 'Use headed mode for debugging.',
      runButton: 'Run Playwright tests',
      runningButton: 'Streaming live run...',
      stopButton: 'Stop current run',
      stoppingButton: 'Stopping run...',
      openReport: 'Open latest HTML report',
      exit: 'Exit',
      liveOutput: 'Live output',
    },
    bootstrap: {
      section: 'Bootstrap',
      title: 'Create your first omni-qa workspace files',
      description: 'Pick a sensible starting point, generate the files, then continue tweaking everything in the editor.',
      defaultEnvironment: 'Default environment',
      baseUrl: 'Base URL',
      authScaffold: 'Authentication scaffold',
      authScaffoldHint: 'This chooses which starter auth fields and .env placeholders get generated.',
      noAuth: 'No auth',
      staticAuthHeaders: 'Static auth headers',
      loginBearer: 'Login and fetch bearer token',
      includeDingtalk: 'Include DingTalk',
      includeDingtalkHint: 'Generate a webhook notification block and placeholder.',
      includeEmail: 'Include email',
      includeEmailHint: 'Generate SMTP notification config and env placeholders.',
      createEnvFile: 'Create local .env',
      createEnvFileHint: 'Uncheck this if you only want `.env.example` at bootstrap time.',
      preview: 'Preview',
      previewTitle: 'What the studio will create',
      createsEnv: 'Also creates <code>.env</code> if it is missing.',
      skipsEnv: 'Skips <code>.env</code> creation for now.',
      then: 'Then',
      nextCommands: 'Next commands',
    },
    general: {
      section: 'General',
      title: 'Project defaults',
      description: 'Choose the primary environment and where tests and reports should live.',
      defaultEnvironment: 'Default environment',
      testDirectory: 'Test directory',
      reportDirectory: 'Report directory',
      globalHeaders: 'Global headers',
      globalHeadersHint:
        'One header per line. Use either <code>key=value</code> or <code>key: value</code>.',
      envVars: 'Environment variables (.env)',
      envVarsHint:
        'The values here are saved into <code>.env</code>. Keep secrets referenced from the config instead of hardcoding them.',
    },
    environments: {
      section: 'Environments',
      title: 'Targets and authentication',
      description: 'Each environment can have its own base URL, headers, and auth workflow.',
      add: 'Add environment',
      empty: 'No environments yet. Add one to point omni-qa at a target API.',
    },
    notifications: {
      section: 'Notifications',
      title: 'Alerts after a test run',
      description: 'Wire up DingTalk or email channels for automated results.',
      add: 'Add notification',
      empty: 'No notification channels configured. Add DingTalk or email when you want push alerts.',
    },
    import: {
      section: 'Import',
      title: 'Generate tests from OpenAPI',
      source: 'Source URL or file path',
      outDir: 'Output directory',
      filterTags: 'Filter tags',
      filterTagsHint: 'Optional. Separate multiple tags with commas or new lines.',
      overwrite: 'Overwrite generated files',
      overwriteHint: 'Use this when you want to regenerate files that already exist.',
      importButton: 'Import and generate tests',
      importingButton: 'Generating tests...',
    },
    result: {
      endpoints: '{count} endpoints',
    },
    environmentCard: {
      title: 'Environment #{index}',
      description: 'Give each target a short stable name like dev or staging.',
      name: 'Name',
      baseUrl: 'Base URL',
      headers: 'Environment headers',
      auth: 'Authentication',
      none: 'None',
      staticHeaders: 'Static headers',
      loginBearer: 'Login and fetch bearer token',
      authHeaders: 'Auth headers',
      loginUrl: 'Login URL',
      method: 'Method',
      tokenPath: 'Token path',
      loginBody: 'Login body',
      noAuthHint: 'No auth selected. Requests run with only global/environment headers.',
    },
    notificationCard: {
      title: 'Notification #{index}',
      description: 'Push concise run summaries to the right audience.',
      type: 'Type',
      dingtalk: 'DingTalk',
      email: 'Email',
      webhook: 'Webhook',
      recipients: 'Recipients',
      smtpHost: 'SMTP host',
      smtpPort: 'SMTP port',
      secure: 'Secure',
      smtpUser: 'SMTP user',
      smtpPassword: 'SMTP password',
    },
    runbook: {
      section: 'Runbook',
      title: 'Next commands',
      footer: 'Tip: keep this terminal open while the studio is running. Press Ctrl+C to stop the local server.',
    },
  },
}

export const locale = ref<Locale>(resolveInitialLocale())

export const localeChoices = SUPPORTED_LOCALES.map((value) => ({
  value,
  labelKey: value === 'zh-CN' ? 'language.zhCN' : 'language.enUS',
}))

export function initializeI18n() {
  watch(locale, applyLocale, { immediate: true })
}

export function setLocale(value: Locale) {
  locale.value = value
}

export function t(key: string, values?: Record<string, string | number>): string {
  const template =
    resolveMessage(locale.value, key) ??
    resolveMessage(DEFAULT_LOCALE, key) ??
    resolveMessage('en-US', key) ??
    key

  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? `{${name}}`))
}

function resolveInitialLocale(): Locale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE
  }

  const savedValue = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  return isLocale(savedValue) ? savedValue : DEFAULT_LOCALE
}

function resolveMessage(localeValue: Locale, key: string): string | undefined {
  const target = key.split('.').reduce<string | MessageTree | undefined>((result, segment) => {
    if (typeof result === 'string' || result === undefined) {
      return result
    }

    return result[segment]
  }, messages[localeValue])

  return typeof target === 'string' ? target : undefined
}

function applyLocale(value: Locale) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(LOCALE_STORAGE_KEY, value)
  document.documentElement.lang = value
  document.title = resolveMessage(value, 'page.documentTitle') ?? resolveMessage(DEFAULT_LOCALE, 'page.documentTitle') ?? document.title
}

function isLocale(value: string | null): value is Locale {
  return value === 'zh-CN' || value === 'en-US'
}
