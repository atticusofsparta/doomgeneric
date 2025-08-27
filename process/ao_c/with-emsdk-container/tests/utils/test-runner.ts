import { TestResult, TestSuite, TestConfig } from '../types/index.js';
import { logger } from './logger.js';

export class TestRunner {
  private config: TestConfig;
  private currentSuite?: TestSuite;

  constructor(config?: Partial<TestConfig>) {
    this.config = {
      wadPath: undefined,
      timeout: 30000, // 30 seconds
      retries: 2,
      skipSlowTests: false,
      logLevel: 'INFO',
      aoLoaderConfig: {
        format: "wasm32-unknown-emscripten4",
        inputEncoding: "JSON-1",
        outputEncoding: "JSON-1",
        memoryLimit: "1073741824", // 1GB
        computeLimit: "9000000000",
        extensions: []
      },
      ...config
    };

    logger.setLevel(this.config.logLevel);
  }

  async runTest(
    name: string, 
    testFn: () => Promise<void | any>, 
    options?: { timeout?: number; retries?: number; slow?: boolean }
  ): Promise<TestResult> {
    const actualTimeout = options?.timeout || this.config.timeout;
    const actualRetries = options?.retries || this.config.retries;
    const isSlow = options?.slow || false;

    if (isSlow && this.config.skipSlowTests) {
      logger.warn(`Skipping slow test: ${name}`);
      return {
        name,
        success: false,
        duration: 0,
        error: 'Skipped (slow test)',
        logs: []
      };
    }

    logger.testStart(name);
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= actualRetries + 1; attempt++) {
      try {
        // Run test with timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Test timeout after ${actualTimeout}ms`)), actualTimeout);
        });

        const testPromise = testFn();
        const result = await Promise.race([testPromise, timeoutPromise]);
        
        const duration = Date.now() - startTime;
        logger.testEnd(name, true, duration);

        return {
          name,
          success: true,
          duration,
          data: result,
          logs: logger.getTestLogs(name)
        };

      } catch (error) {
        lastError = error as Error;
        const duration = Date.now() - startTime;
        
        if (attempt <= actualRetries) {
          logger.warn(`Test ${name} failed on attempt ${attempt}/${actualRetries + 1}, retrying...`, { error: lastError.message });
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        } else {
          logger.testEnd(name, false, duration);
          logger.error(`Test ${name} failed after ${actualRetries + 1} attempts`, { error: lastError.message });
        }
      }
    }

    const duration = Date.now() - startTime;
    return {
      name,
      success: false,
      duration,
      error: lastError?.message || 'Unknown error',
      logs: logger.getTestLogs(name)
    };
  }

  async runSuite(name: string, tests: Array<{ name: string; fn: () => Promise<void | any>; options?: any }>): Promise<TestSuite> {
    logger.info(`🧪 Starting test suite: ${name}`);
    const startTime = Date.now();
    const results: TestResult[] = [];

    this.currentSuite = {
      name,
      results: [],
      totalTests: tests.length,
      passedTests: 0,
      failedTests: 0,
      duration: 0
    };

    for (const test of tests) {
      const result = await this.runTest(test.name, test.fn, test.options);
      results.push(result);
      
      if (result.success) {
        this.currentSuite.passedTests++;
      } else {
        this.currentSuite.failedTests++;
      }
    }

    const duration = Date.now() - startTime;
    this.currentSuite.results = results;
    this.currentSuite.duration = duration;

    this.logSuiteResults(this.currentSuite);
    return this.currentSuite;
  }

  private logSuiteResults(suite: TestSuite): void {
    const passRate = ((suite.passedTests / suite.totalTests) * 100).toFixed(1);
    
    logger.info(`🏁 Test suite completed: ${suite.name}`);
    logger.info(`📊 Results: ${suite.passedTests}/${suite.totalTests} passed (${passRate}%)`);
    logger.info(`⏱️  Duration: ${suite.duration}ms`);

    if (suite.failedTests > 0) {
      logger.warn(`❌ Failed tests:`);
      suite.results
        .filter(r => !r.success)
        .forEach(r => logger.warn(`  - ${r.name}: ${r.error}`));
    }
  }

  // Helper method to create test functions with common patterns
  static createAsyncTest(fn: () => Promise<void>): () => Promise<void> {
    return async () => {
      await fn();
    };
  }

  static createExpectTest<T>(
    fn: () => Promise<T>, 
    expectation: (result: T) => boolean, 
    errorMessage?: string
  ): () => Promise<void> {
    return async () => {
      const result = await fn();
      if (!expectation(result)) {
        throw new Error(errorMessage || `Expectation failed for result: ${JSON.stringify(result)}`);
      }
    };
  }

  // Utility assertions
  static expect = {
    truthy: <T>(value: T, message?: string): void => {
      if (!value) {
        throw new Error(message || `Expected truthy value, got: ${value}`);
      }
    },

    falsy: <T>(value: T, message?: string): void => {
      if (value) {
        throw new Error(message || `Expected falsy value, got: ${value}`);
      }
    },

    equal: <T>(actual: T, expected: T, message?: string): void => {
      if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
      }
    },

    notEqual: <T>(actual: T, expected: T, message?: string): void => {
      if (actual === expected) {
        throw new Error(message || `Expected not ${expected}, but got ${actual}`);
      }
    },

    contains: (container: string, value: string, message?: string): void => {
      if (!container.includes(value)) {
        throw new Error(message || `Expected "${container}" to contain "${value}"`);
      }
    },

    notContains: (container: string, value: string, message?: string): void => {
      if (container.includes(value)) {
        throw new Error(message || `Expected "${container}" not to contain "${value}"`);
      }
    },

    noError: (result: any, message?: string): void => {
      if (result.Error) {
        throw new Error(message || `Expected no error, but got: ${result.Error}`);
      }
    },

    hasError: (result: any, expectedError?: string, message?: string): void => {
      if (!result.Error) {
        throw new Error(message || `Expected error, but got success`);
      }
      if (expectedError && !result.Error.includes(expectedError)) {
        throw new Error(message || `Expected error containing "${expectedError}", got: ${result.Error}`);
      }
    },

    performance: (duration: number, maxMs: number, operation?: string): void => {
      if (duration > maxMs) {
        throw new Error(`Performance test failed: ${operation || 'Operation'} took ${duration}ms, expected < ${maxMs}ms`);
      }
    }
  };

  // Generate test report
  generateReport(suites: TestSuite[]): string {
    const totalTests = suites.reduce((sum, suite) => sum + suite.totalTests, 0);
    const totalPassed = suites.reduce((sum, suite) => sum + suite.passedTests, 0);
    const totalFailed = suites.reduce((sum, suite) => sum + suite.failedTests, 0);
    const totalDuration = suites.reduce((sum, suite) => sum + suite.duration, 0);
    const overallPassRate = ((totalPassed / totalTests) * 100).toFixed(1);

    let report = '# DOOM AO Test Report\n\n';
    report += `## Overall Results\n`;
    report += `- **Total Tests**: ${totalTests}\n`;
    report += `- **Passed**: ${totalPassed}\n`;
    report += `- **Failed**: ${totalFailed}\n`;
    report += `- **Pass Rate**: ${overallPassRate}%\n`;
    report += `- **Total Duration**: ${totalDuration}ms\n\n`;

    suites.forEach(suite => {
      const suitePassRate = ((suite.passedTests / suite.totalTests) * 100).toFixed(1);
      report += `## Suite: ${suite.name}\n`;
      report += `- **Tests**: ${suite.totalTests}\n`;
      report += `- **Passed**: ${suite.passedTests}\n`;
      report += `- **Failed**: ${suite.failedTests}\n`;
      report += `- **Pass Rate**: ${suitePassRate}%\n`;
      report += `- **Duration**: ${suite.duration}ms\n\n`;

      if (suite.failedTests > 0) {
        report += `### Failed Tests:\n`;
        suite.results
          .filter(r => !r.success)
          .forEach(r => {
            report += `- **${r.name}**: ${r.error}\n`;
          });
        report += '\n';
      }
    });

    return report;
  }
}
