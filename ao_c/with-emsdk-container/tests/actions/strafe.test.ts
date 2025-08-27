import { DoomTestClient } from '../utils/doom-client.js';
import { TestRunner } from '../utils/test-runner.js';
import { logger } from '../utils/logger.js';
import { DOOM_KEYS } from '../types/index.js';

const runner = new TestRunner({
  logLevel: 'INFO',
  timeout: 15000,
});

export async function runStrafeActionTest(): Promise<void> {
  const client = new DoomTestClient();

  // Initialize game first
  await client.initialize();
  await client.loadWAD();
  await client.initializeGame();
  await client.waitForStableState();

  const tests = [
    {
      name: 'STRAFE Action - Basic Press/Release',
      fn: TestRunner.createAsyncTest(async () => {
        const pressResult = await client.strafePress();
        TestRunner.expect.noError(pressResult, 'STRAFE press should not produce errors');
        TestRunner.expect.contains(pressResult.Output || '', 'Key pressed', 'Should confirm STRAFE press');

        const releaseResult = await client.strafeRelease();
        TestRunner.expect.noError(releaseResult, 'STRAFE release should not produce errors');
        TestRunner.expect.contains(releaseResult.Output || '', 'Key released', 'Should confirm STRAFE release');
      })
    },

    {
      name: 'STRAFE Action - Hold and Release',
      fn: TestRunner.createAsyncTest(async () => {
        // Press and hold STRAFE
        await client.strafePress();
        
        // Process some ticks while STRAFE is held
        const tickResults = await client.runTicks(5, 16);
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'No ticks should fail while STRAFE is held');
        
        // Release STRAFE
        await client.strafeRelease();
      })
    },

    {
      name: 'STRAFE Action - Tap Test',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.strafeTap(100);
        TestRunner.expect.noError(result.press, 'STRAFE tap press should not produce errors');
        TestRunner.expect.noError(result.release, 'STRAFE tap release should not produce errors');
        TestRunner.expect.contains(result.press.Output || '', 'Key pressed', 'Should confirm STRAFE tap press');
        TestRunner.expect.contains(result.release.Output || '', 'Key released', 'Should confirm STRAFE tap release');
      })
    },

    {
      name: 'STRAFE with Movement Integration',
      fn: TestRunner.createAsyncTest(async () => {
        // Test STRAFE + movement combination
        await client.strafePress();
        
        // Try left/right movement while strafing (should become side-stepping)
        const leftResult = await client.keyTap(DOOM_KEYS.TURN_LEFT, 50);
        const rightResult = await client.keyTap(DOOM_KEYS.TURN_RIGHT, 50);
        
        TestRunner.expect.noError(leftResult.press, 'Left movement while strafing should work');
        TestRunner.expect.noError(rightResult.press, 'Right movement while strafing should work');
        
        await client.strafeRelease();
      })
    },

    {
      name: 'STRAFE Performance Test',
      fn: TestRunner.createAsyncTest(async () => {
        const rapidCount = 10;
        const startTime = Date.now();

        for (let i = 0; i < rapidCount; i++) {
          await client.strafeTap(20); // Fast strafe taps
        }

        const duration = Date.now() - startTime;
        const avgTime = duration / rapidCount;

        TestRunner.expect.performance(avgTime, 100, 'Average STRAFE tap time');
        logger.info(`STRAFE performance: ${rapidCount} taps in ${duration}ms (avg: ${avgTime.toFixed(2)}ms)`);
      })
    },

    {
      name: 'STRAFE Key Mapping Verification',
      fn: TestRunner.createAsyncTest(async () => {
        // Verify that the STRAFE constant maps to the correct key
        TestRunner.expect.equal(DOOM_KEYS.STRAFE, 'Alt', 'STRAFE should map to Alt key');
        
        // Test direct Alt key usage
        const altResult = await client.keyTap('Alt', 50);
        TestRunner.expect.noError(altResult.press, 'Direct Alt key should work');
        TestRunner.expect.noError(altResult.release, 'Direct Alt key release should work');
      })
    }
  ];

  const suite = await runner.runSuite('DOOM STRAFE Action Tests', tests);
  
  // Cleanup
  await client.cleanup();
  
  if (suite.failedTests > 0) {
    throw new Error(`STRAFE action tests failed: ${suite.failedTests}/${suite.totalTests} tests failed`);
  }
  
  logger.info('✅ All STRAFE action tests passed successfully');
}

// Allow running this test directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runStrafeActionTest()
    .then(() => {
      logger.info('🎉 STRAFE action test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 STRAFE action test failed', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    });
}
