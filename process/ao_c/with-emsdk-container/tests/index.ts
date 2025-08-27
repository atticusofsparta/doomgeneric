#!/usr/bin/env tsx

import { logger } from './utils/logger.js';
import { TestRunner } from './utils/test-runner.js';
import { runInitializationTests } from './initialization/index.js';
import { runInputTests } from './input/index.js';
import { runMouseTests } from './mouse/index.js';
import { runMovementTests } from './movement/index.js';
import { runMenuTests } from './menu/index.js';
import { runGameStateTests } from './gamestate/index.js';
import { runRenderingTests } from './rendering/index.js';
import { runIntegrationTests } from './integration/index.js';

async function main() {
  logger.info('🎮 Starting DOOM AO Comprehensive Test Suite');
  logger.info('===========================================');

  const startTime = Date.now();
  const suites = [];
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  try {
    // Test suites in logical order
    const testSuites = [
      { name: 'Initialization', fn: runInitializationTests, critical: true },
      { name: 'Input', fn: runInputTests, critical: true },
      { name: 'Mouse', fn: runMouseTests, critical: false },
      { name: 'Movement', fn: runMovementTests, critical: false },
      { name: 'Menu', fn: runMenuTests, critical: false },
      { name: 'Game State', fn: runGameStateTests, critical: false },
      { name: 'Rendering', fn: runRenderingTests, critical: false },
      { name: 'Integration', fn: runIntegrationTests, critical: false },
    ];

    for (const suite of testSuites) {
      try {
        logger.info(`\\n🧪 Running ${suite.name} Tests...`);
        await suite.fn();
        
        logger.info(`✅ ${suite.name} tests completed successfully`);
        
        // Note: Individual test counting would require modification to return detailed results
        // For now, we'll track suite completion
        totalTests++;
        totalPassed++;
        
      } catch (error) {
        logger.error(`❌ ${suite.name} tests failed: ${error.message}`);
        totalTests++;
        totalFailed++;
        
        if (suite.critical) {
          logger.error(`💥 Critical test suite ${suite.name} failed, aborting remaining tests`);
          break;
        } else {
          logger.warn(`⚠️  Non-critical test suite ${suite.name} failed, continuing with remaining tests`);
        }
      }
    }

  } catch (error) {
    logger.error('💥 Test suite execution failed', { error: error.message });
  }

  const duration = Date.now() - startTime;
  const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';

  logger.info('\\n📊 Final Test Results');
  logger.info('====================');
  logger.info(`Total Suites: ${totalTests}`);
  logger.info(`Passed: ${totalPassed}`);
  logger.info(`Failed: ${totalFailed}`);
  logger.info(`Pass Rate: ${passRate}%`);
  logger.info(`Duration: ${duration}ms`);

  if (totalFailed === 0) {
    logger.info('🎉 All test suites passed! DOOM AO integration is working perfectly.');
    process.exit(0);
  } else {
    logger.error(`💥 ${totalFailed} test suite(s) failed. Please review the logs above.`);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
DOOM AO Test Suite

Usage: npm test [options]
       tsx tests/index.ts [options]

Options:
  --help, -h        Show this help message
  --verbose, -v     Enable verbose logging (DEBUG level)
  --quiet, -q       Reduce logging (ERROR level only)
  --fast            Skip slow tests
  --timeout <ms>    Set default timeout (default: 30000)

Individual test suites:
  npm run test:init         Run initialization tests only
  npm run test:input        Run input tests only
  npm run test:mouse        Run mouse input tests only
  npm run test:movement     Run movement tests only
  npm run test:menu         Run menu tests only
  npm run test:gamestate    Run game state tests only
  npm run test:rendering    Run rendering tests only
  npm run test:integration  Run integration tests only

Examples:
  npm test                  Run all test suites
  npm test -- --verbose     Run all tests with verbose logging
  npm test -- --fast        Run all tests, skipping slow ones
  tsx tests/index.ts --quiet Run with minimal logging
`);
  process.exit(0);
}

// Configure logging based on arguments
if (args.includes('--verbose') || args.includes('-v')) {
  logger.setLevel('DEBUG');
} else if (args.includes('--quiet') || args.includes('-q')) {
  logger.setLevel('ERROR');
}

// Run the main test suite
main().catch((error) => {
  logger.error('Unhandled error in test suite', { error: error.message, stack: error.stack });
  process.exit(1);
});
