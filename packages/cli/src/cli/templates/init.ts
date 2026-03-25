export type InitAuthMode = 'none' | 'header' | 'bearer';

export interface InitTemplateOptions {
  defaultEnv: string;
  baseUrl: string;
  authMode: InitAuthMode;
  includeDingtalk: boolean;
  includeEmail: boolean;
}

export function getPlaywrightConfigTemplate(): string {
  return [
    "import { createOmniPlaywrightConfig } from '@omni-qa/core';",
    '',
    'export default createOmniPlaywrightConfig();',
    '',
  ].join('\n');
}

export function getConfigTemplate(options: InitTemplateOptions): string {
  const lines = [
    "import type { OmniQAConfig } from '@omni-qa/core';",
    '',
    'const config: OmniQAConfig = {',
    `  defaultEnv: ${quote(options.defaultEnv)},`,
    '',
    '  globalHeaders: {',
    "    'Content-Type': 'application/json',",
    "    'Accept': 'application/json',",
    '  },',
    '',
    '  envs: {',
    `    ${quote(options.defaultEnv)}: {`,
    `      baseURL: ${quote(options.baseUrl)},`,
  ];

  const authLines = getAuthConfigLines(options.authMode);
  if (authLines.length > 0) {
    lines.push('      auth: {');
    for (const line of authLines) {
      lines.push(`        ${line}`);
    }
    lines.push('      },');
  }

  lines.push('    },');
  lines.push('  },');

  const notifyBlocks = getNotifyBlocks(options);
  if (notifyBlocks.length > 0) {
    lines.push('');
    lines.push('  notify: [');
    for (const block of notifyBlocks) {
      lines.push('    {');
      for (const line of block) {
        lines.push(`      ${line}`);
      }
      lines.push('    },');
    }
    lines.push('  ],');
  }

  lines.push('');
  lines.push("  testDir: 'tests/api',");
  lines.push("  reportDir: 'reports',");
  lines.push('};');
  lines.push('');
  lines.push('export default config;');
  lines.push('');

  return lines.join('\n');
}

export function getEnvTemplate(options: InitTemplateOptions): string {
  const sections: string[][] = [];

  if (options.authMode === 'header') {
    sections.push([
      '# API Authentication',
      'API_KEY=your-api-key-here',
    ]);
  }

  if (options.authMode === 'bearer') {
    sections.push([
      '# API Authentication',
      'USERNAME=admin',
      'PASSWORD=admin123',
    ]);
  }

  if (options.includeDingtalk) {
    sections.push([
      '# DingTalk Notification',
      'DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx',
    ]);
  }

  if (options.includeEmail) {
    sections.push([
      '# Email Notification (SMTP)',
      'SMTP_HOST=smtp.example.com',
      'SMTP_USER=qa@example.com',
      'SMTP_PASS=your-smtp-password',
      'EMAIL_TO=team@example.com',
    ]);
  }

  if (sections.length === 0) {
    return ['# Add your local secrets here', ''].join('\n');
  }

  return `${sections.map((section) => section.join('\n')).join('\n\n')}\n`;
}

function getAuthConfigLines(authMode: InitAuthMode): string[] {
  if (authMode === 'header') {
    return [
      "type: 'header',",
      'headers: {',
      "  'Authorization': 'Bearer ${API_KEY}',",
      '},',
    ];
  }

  if (authMode === 'bearer') {
    return [
      "type: 'bearer',",
      'login: {',
      "  url: '/auth/login',",
      "  method: 'POST',",
      '  body: {',
      "    username: '${USERNAME}',",
      "    password: '${PASSWORD}',",
      '  },',
      "  tokenPath: 'data.access_token',",
      '},',
    ];
  }

  return [];
}

function getNotifyBlocks(options: InitTemplateOptions): string[][] {
  const blocks: string[][] = [];

  if (options.includeDingtalk) {
    blocks.push([
      "type: 'dingtalk',",
      "webhook: '${DINGTALK_WEBHOOK}',",
    ]);
  }

  if (options.includeEmail) {
    blocks.push([
      "type: 'email',",
      'smtp: {',
      "  host: '${SMTP_HOST}',",
      '  port: 465,',
      '  secure: true,',
      "  user: '${SMTP_USER}',",
      "  pass: '${SMTP_PASS}',",
      '},',
      "to: ['${EMAIL_TO}'],",
    ]);
  }

  return blocks;
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
