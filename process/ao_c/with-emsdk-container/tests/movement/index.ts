import { DoomTestClient } from '../utils/doom-client.js';
import { TestRunner } from '../utils/test-runner.js';
import { logger } from '../utils/logger.js';
import { DOOM_KEYS } from '../types/index.js';

const runner = new TestRunner({
  logLevel: 'INFO',
  timeout: 20000,
});

export async function runMovementTests(): Promise<void> {
  const client = new DoomTestClient();

  // Initialize game first
  await client.initialize();
  await client.loadWAD();
  await client.initializeGame();
  await client.waitForStableState();

  const tests = [
    {
      name: 'Forward Movement',
      fn: TestRunner.createAsyncTest(async () => {
        // Hold forward key for several ticks
        await client.keyPress(DOOM_KEYS.FORWARD);
        
        const tickResults = await client.runTicks(10, 16);
        
        await client.keyRelease(DOOM_KEYS.FORWARD);
        
        // All ticks should succeed
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'Movement ticks should not produce errors');
        
        logger.info('Forward movement completed without errors');
      })
    },

    {
      name: 'Backward Movement',
      fn: TestRunner.createAsyncTest(async () => {
        await client.keyPress(DOOM_KEYS.BACKWARD);
        const tickResults = await client.runTicks(10, 16);
        await client.keyRelease(DOOM_KEYS.BACKWARD);
        
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'Backward movement should work without errors');
      })
    },

    {
      name: 'Left Turn',
      fn: TestRunner.createAsyncTest(async () => {
        await client.keyPress(DOOM_KEYS.TURN_LEFT);
        const tickResults = await client.runTicks(8, 16);
        await client.keyRelease(DOOM_KEYS.TURN_LEFT);
        
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'Left turning should work without errors');
      })
    },

    {
      name: 'Right Turn',
      fn: TestRunner.createAsyncTest(async () => {
        await client.keyPress(DOOM_KEYS.TURN_RIGHT);
        const tickResults = await client.runTicks(8, 16);
        await client.keyRelease(DOOM_KEYS.TURN_RIGHT);
        
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'Right turning should work without errors');
      })
    },

    {
      name: 'Strafe Left',
      fn: TestRunner.createAsyncTest(async () => {
        await client.keyPress(DOOM_KEYS.STRAFE_LEFT);
        const tickResults = await client.runTicks(10, 16);
        await client.keyRelease(DOOM_KEYS.STRAFE_LEFT);
        
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'Left strafing should work without errors');
      })
    },

    {
      name: 'Strafe Right',
      fn: TestRunner.createAsyncTest(async () => {
        await client.keyPress(DOOM_KEYS.STRAFE_RIGHT);
        const tickResults = await client.runTicks(10, 16);
        await client.keyRelease(DOOM_KEYS.STRAFE_RIGHT);
        
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'Right strafing should work without errors');
      })
    },

    {
      name: 'Running Movement',
      fn: TestRunner.createAsyncTest(async () => {
        // Hold run + forward
        await client.keyPress(DOOM_KEYS.RUN);
        await client.keyPress(DOOM_KEYS.FORWARD);
        
        const tickResults = await client.runTicks(15, 16);
        
        await client.keyRelease(DOOM_KEYS.FORWARD);
        await client.keyRelease(DOOM_KEYS.RUN);
        
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'Running movement should work without errors');
      })
    },

    {
      name: 'Diagonal Movement (Forward + Strafe)',
      fn: TestRunner.createAsyncTest(async () => {
        // Move diagonally
        await client.keyPress(DOOM_KEYS.FORWARD);
        await client.keyPress(DOOM_KEYS.STRAFE_LEFT);
        
        const tickResults = await client.runTicks(12, 16);
        
        await client.keyRelease(DOOM_KEYS.STRAFE_LEFT);
        await client.keyRelease(DOOM_KEYS.FORWARD);
        
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'Diagonal movement should work without errors');
      })
    },

    {
      name: 'Complex Movement Combination',
      fn: TestRunner.createAsyncTest(async () => {
        // Complex movement: run + forward + turn
        await client.keyPress(DOOM_KEYS.RUN);
        await client.keyPress(DOOM_KEYS.FORWARD);
        await client.keyPress(DOOM_KEYS.TURN_LEFT);
        
        const tickResults = await client.runTicks(10, 16);
        
        await client.keyRelease(DOOM_KEYS.TURN_LEFT);
        await client.keyRelease(DOOM_KEYS.FORWARD);
        await client.keyRelease(DOOM_KEYS.RUN);
        
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'Complex movement should work without errors');
      })
    },

    {
      name: 'Movement Direction Changes',
      fn: TestRunner.createAsyncTest(async () => {
        // Test rapid direction changes
        const movements = [
          DOOM_KEYS.FORWARD,
          DOOM_KEYS.BACKWARD,
          DOOM_KEYS.STRAFE_LEFT,
          DOOM_KEYS.STRAFE_RIGHT
        ];

        for (const movement of movements) {
          await client.keyPress(movement);
          await client.runTicks(3, 16);
          await client.keyRelease(movement);
          
          // Small pause between movements
          await client.runTicks(2, 16);
        }
        
        logger.info('All movement direction changes completed successfully');
      })
    },

    {
      name: 'Turning While Moving',
      fn: TestRunner.createAsyncTest(async () => {
        // Start moving forward
        await client.keyPress(DOOM_KEYS.FORWARD);
        await client.runTicks(5, 16);
        
        // Add turning
        await client.keyPress(DOOM_KEYS.TURN_RIGHT);
        await client.runTicks(8, 16);
        
        // Release turn, continue forward
        await client.keyRelease(DOOM_KEYS.TURN_RIGHT);
        await client.runTicks(5, 16);
        
        // Stop moving
        await client.keyRelease(DOOM_KEYS.FORWARD);
        
        logger.info('Turning while moving completed successfully');
      })
    },

    {
      name: 'Movement State Persistence',
      fn: TestRunner.createAsyncTest(async () => {
        // Test that movement states persist across multiple ticks
        await client.keyPress(DOOM_KEYS.FORWARD);
        
        // Process many ticks while holding key
        const longTickResults = await client.runTicks(30, 16);
        
        await client.keyRelease(DOOM_KEYS.FORWARD);
        
        // All ticks should succeed with sustained movement
        const failedTicks = longTickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'Sustained movement should work without errors');
        
        // Verify consistent tick processing
        const outputs = longTickResults.map(r => r.Output);
        const uniqueOutputs = [...new Set(outputs)];
        TestRunner.expect.equal(uniqueOutputs.length, 1, 'All movement ticks should have consistent output');
      })
    },

    {
      name: 'Stop and Start Movement',
      fn: TestRunner.createAsyncTest(async () => {
        // Test stopping and starting movement multiple times
        for (let i = 0; i < 3; i++) {
          // Start movement
          await client.keyPress(DOOM_KEYS.FORWARD);
          await client.runTicks(5, 16);
          
          // Stop movement
          await client.keyRelease(DOOM_KEYS.FORWARD);
          await client.runTicks(3, 16);
        }
        
        logger.info('Stop/start movement cycles completed successfully');
      })
    },

    {
      name: 'All Movement Keys Functionality',
      fn: TestRunner.createAsyncTest(async () => {
        const allMovementKeys = [
          DOOM_KEYS.FORWARD,
          DOOM_KEYS.BACKWARD,
          DOOM_KEYS.TURN_LEFT,
          DOOM_KEYS.TURN_RIGHT,
          DOOM_KEYS.STRAFE_LEFT,
          DOOM_KEYS.STRAFE_RIGHT,
          DOOM_KEYS.RUN
        ];

        // Test each movement key individually
        for (const key of allMovementKeys) {
          await client.keyPress(key);
          const tickResults = await client.runTicks(3, 16);
          await client.keyRelease(key);
          
          const failedTicks = tickResults.filter(r => r.Error);
          TestRunner.expect.equal(
            failedTicks.length, 
            0, 
            `Movement key ${key} should work without errors`
          );
          
          // Small delay between tests
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      })
    },

    {
      name: 'Movement Performance Test',
      fn: TestRunner.createAsyncTest(async () => {
        const startTime = Date.now();
        
        // Perform sustained movement with performance tracking
        await client.keyPress(DOOM_KEYS.FORWARD);
        await client.keyPress(DOOM_KEYS.RUN);
        
        const perfResults = await client.performanceTest(30);
        
        await client.keyRelease(DOOM_KEYS.RUN);
        await client.keyRelease(DOOM_KEYS.FORWARD);
        
        const totalDuration = Date.now() - startTime;
        
        // Movement should not significantly impact performance
        TestRunner.expect.performance(perfResults.avgDuration, 500, 'Movement tick performance');
        
        logger.info('Movement performance test completed', { 
          totalDuration, 
          avgTickDuration: perfResults.avgDuration 
        });
      }),
      options: { slow: true }
    }
  ];

  const suite = await runner.runSuite('DOOM Movement Tests', tests);
  
  // Cleanup
  await client.cleanup();
  
  if (suite.failedTests > 0) {
    throw new Error(`Movement tests failed: ${suite.failedTests}/${suite.totalTests} tests failed`);
  }
  
  logger.info('✅ All movement tests passed successfully');
}

// Allow running this test suite directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMovementTests()
    .then(() => {
      logger.info('🎉 Movement test suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Movement test suite failed', { error: error.message });
      process.exit(1);
    });
}
