import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { loadConfig } from '../config/loader.js';
import { sendDingTalk } from './dingtalk.js';
import { sendEmail } from './email.js';
import type { TestReport, FailureDetail } from '../config/types.js';

/**
 * Playwright custom Reporter that sends notifications (DingTalk / Email)
 * after test execution completes.
 */
class NotifierReporter implements Reporter {
  private failures: FailureDetail[] = [];
  private passed = 0;
  private failed = 0;
  private skipped = 0;
  private startTime = 0;

  onBegin(_config: FullConfig, _suite: Suite) {
    this.startTime = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    switch (result.status) {
      case 'passed':
        this.passed++;
        break;
      case 'failed':
      case 'timedOut':
        this.failed++;
        this.failures.push({
          title: test.title,
          endpoint: extractEndpoint(test.title),
          error: result.errors?.[0]?.message?.slice(0, 200) ?? 'Unknown error',
        });
        break;
      case 'skipped':
        this.skipped++;
        break;
    }
  }

  async onEnd(result: FullResult) {
    const duration = Date.now() - this.startTime;
    const env = process.env.OMNI_ENV ?? 'unknown';

    const report: TestReport = {
      env,
      total: this.passed + this.failed + this.skipped,
      passed: this.passed,
      failed: this.failed,
      skipped: this.skipped,
      duration,
      failures: this.failures,
      timestamp: new Date().toISOString(),
    };

    try {
      const config = await loadConfig(env);

      if (!config.notify || config.notify.length === 0) {
        return;
      }

      const notifyPromises = config.notify.map(async (notifyConfig) => {
        try {
          if (notifyConfig.type === 'dingtalk') {
            await sendDingTalk(notifyConfig.webhook, report);
            console.log('📢 DingTalk notification sent');
          } else if (notifyConfig.type === 'email') {
            await sendEmail(notifyConfig.smtp, notifyConfig.to, report);
            console.log('📧 Email notification sent');
          }
        } catch (err) {
          console.error(
            `⚠️  Failed to send ${notifyConfig.type} notification:`,
            err instanceof Error ? err.message : err
          );
        }
      });

      await Promise.all(notifyPromises);
    } catch (err) {
      console.error(
        '⚠️  Failed to load config for notifications:',
        err instanceof Error ? err.message : err
      );
    }
  }
}

/**
 * Extract endpoint info from test title.
 * e.g. "GET /api/users → should respond successfully" → "GET /api/users"
 */
function extractEndpoint(title: string): string {
  const match = title.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+/i);
  return match ? match[0] : title;
}

export default NotifierReporter;
