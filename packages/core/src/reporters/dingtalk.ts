import type { TestReport } from '../config/types.js';

/**
 * Send test report to DingTalk via Webhook (Markdown message).
 */
export async function sendDingTalk(
  webhook: string,
  report: TestReport
): Promise<void> {
  const statusIcon = report.failed > 0 ? '❌' : '✅';
  const title = `${statusIcon} omni-qa 测试报告`;

  const failureSection =
    report.failures.length > 0
      ? `\n\n**失败接口：**\n${report.failures
          .map((f) => `- ${f.endpoint}: ${f.error}`)
          .join('\n')}`
      : '';

  const markdown = `### ${title}

**环境：** ${report.env}
**时间：** ${report.timestamp}
**耗时：** ${formatDuration(report.duration)}

---

| 状态 | 数量 |
|------|------|
| ✅ 通过 | ${report.passed} |
| ❌ 失败 | ${report.failed} |
| ⏭️ 跳过 | ${report.skipped} |
| **总计** | **${report.total}** |
${failureSection}`;

  const body = {
    msgtype: 'markdown',
    markdown: {
      title,
      text: markdown,
    },
  };

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DingTalk notification failed: ${response.status} ${text}`);
  }

  const result = await response.json() as { errcode: number; errmsg: string };
  if (result.errcode !== 0) {
    throw new Error(`DingTalk API error: ${result.errmsg}`);
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
