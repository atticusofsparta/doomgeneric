import { DoomTestClient } from '../utils/doom-client.js';
import { TestRunner } from '../utils/test-runner.js';
import { logger } from '../utils/logger.js';
import { DOOM_KEYS } from '../types/index.js';

const runner = new TestRunner({
  logLevel: 'INFO',
  timeout: 15000,
});

export async function runAutorunActionTest(): Promise<void> {
  const client = new DoomTestClient();

  // Initialize game first
  await client.initialize();
  await client.loadWAD();
  await client.initializeGame();
  await client.waitForStableState();

  const tests = [
    {
      name: 'AUTORUN Action - Basic Press/Release',
      fn: TestRunner.createAsyncTest(async () => {
        const pressResult = await client.autorunPress();
        TestRunner.expect.noError(pressResult, 'AUTORUN press should not produce errors');
        TestRunner.expect.contains(pressResult.Output || '', 'Key pressed', 'Should confirm AUTORUN press');

        const releaseResult = await client.autorunRelease();
        TestRunner.expect.noError(releaseResult, 'AUTORUN release should not produce errors');
        TestRunner.expect.contains(releaseResult.Output || '', 'Key released', 'Should confirm AUTORUN release');
      })
    },

    {
      name: 'AUTORUN Action - Toggle Test',
      fn: TestRunner.createAsyncTest(async () => {
        // Test toggle functionality (press and release quickly)
        const result = await client.autorunToggle();
        TestRunner.expect.noError(result.press, 'AUTORUN toggle press should not produce errors');
        TestRunner.expect.noError(result.release, 'AUTORUN toggle release should not produce errors');
        TestRunner.expect.contains(result.press.Output || '', 'Key pressed', 'Should confirm AUTORUN toggle press');
        TestRunner.expect.contains(result.release.Output || '', 'Key released', 'Should confirm AUTORUN toggle release');
      })
    },

    {
      name: 'AUTORUN Multiple Toggles',
      fn: TestRunner.createAsyncTest(async () => {
        // Test multiple toggle cycles
        for (let i = 0; i < 3; i++) {
          const result = await client.autorunToggle();
          TestRunner.expect.noError(result.press, `AUTORUN toggle ${i + 1} press should work`);
          TestRunner.expect.noError(result.release, `AUTORUN toggle ${i + 1} release should work`);
          
          // Small delay between toggles
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      })
    },

    {
      name: 'AUTORUN with Movement Test',
      fn: TestRunner.createAsyncTest(async () => {
        // Enable autorun
        await client.autorunPress();
        
        // Test movement while autorun is enabled
        const forwardResult = await client.keyTap(DOOM_KEYS.FORWARD, 100);
        TestRunner.expect.noError(forwardResult.press, 'Forward movement with autorun should work');
        
        // Disable autorun
        await client.autorunRelease();
        
        // Test movement while autorun is disabled
        const backwardResult = await client.keyTap(DOOM_KEYS.BACKWARD, 100);
        TestRunner.expect.noError(backwardResult.press, 'Backward movement without autorun should work');
      })
    },

    {
      name: 'AUTORUN with Manual Run Override',
      fn: TestRunner.createAsyncTest(async () => {
        // Enable autorun
        await client.autorunToggle();
        
        // Test that manual run key still works (should override autorun state)
        const runResult = await client.keyTap(DOOM_KEYS.RUN, 100);
        TestRunner.expect.noError(runResult.press, 'Manual RUN should work even with autorun enabled');
        
        // Disable autorun
        await client.autorunToggle();
      })
    },

    {
      name: 'AUTORUN Key Mapping Verification',
      fn: TestRunner.createAsyncTest(async () => {
        // Verify that the AUTORUN constant maps to the correct key
        TestRunner.expect.equal(DOOM_KEYS.AUTORUN, 'CapsLock', 'AUTORUN should map to CapsLock key');
        
        // Test direct CapsLock key usage
        const capsResult = await client.keyTap('CapsLock', 50);
        TestRunner.expect.noError(capsResult.press, 'Direct CapsLock key should work');
        TestRunner.expect.noError(capsResult.release, 'Direct CapsLock key release should work');
      })
    },

    {
      name: 'AUTORUN Performance Test',
      fn: TestRunner.createAsyncTest(async () => {
        const rapidCount = 8;
        const startTime = Date.now();

        for (let i = 0; i < rapidCount; i++) {
          await client.autorunToggle();
        }

        const duration = Date.now() - startTime;
        const avgTime = duration / rapidCount;

        TestRunner.expect.performance(avgTime, 150, 'Average AUTORUN toggle time');
        logger.info(`AUTORUN performance: ${rapidCount} toggles in ${duration}ms (avg: ${avgTime.toFixed(2)}ms)`);
      })
    },

    {
      name: 'AUTORUN State Persistence',
      fn: TestRunner.createAsyncTest(async () => {
        // Test that autorun state persists through game ticks
        await client.autorunPress();
        
        // Process several ticks while autorun is enabled
        const tickResults = await client.runTicks(5, 16);
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'No ticks should fail while autorun is enabled');
        
        await client.autorunRelease();
        
        // Process more ticks after disabling autorun
        const moreTicks = await client.runTicks(3, 16);
        const moreFailedTicks = moreTicks.filter(r => r.Error);
        TestRunner.expect.equal(moreFailedTicks.length, 0, 'No ticks should fail after disabling autorun');
      })
    }
  ];

  const suite = await runner.runSuite('DOOM AUTORUN Action Tests', tests);
  
  // Cleanup
  await client.cleanup();
  
  if (suite.failedTests > 0) {
    throw new Error(`AUTORUN action tests failed: ${suite.failedTests}/${suite.totalTests} tests failed`);
  }
  
  logger.info('✅ All AUTORUN action tests passed successfully');
}

// Allow running this test directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAutorunActionTest()
    .then(() => {
      logger.info('🎉 AUTORUN action test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 AUTORUN action test failed', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    });
}
