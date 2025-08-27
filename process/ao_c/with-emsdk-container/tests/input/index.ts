import { DoomTestClient } from '../utils/doom-client.js';
import { TestRunner } from '../utils/test-runner.js';
import { logger } from '../utils/logger.js';
import { DOOM_KEYS } from '../types/index.js';

const runner = new TestRunner({
  logLevel: 'INFO',
  timeout: 15000,
});

export async function runInputTests(): Promise<void> {
  const client = new DoomTestClient();

  // Initialize game first
  await client.initialize();
  await client.loadWAD();
  await client.initializeGame();
  await client.waitForStableState();

  const tests = [
    {
      name: 'Basic Key Press',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.keyPress(DOOM_KEYS.FORWARD);
        TestRunner.expect.noError(result, 'Key press should not produce errors');
        TestRunner.expect.contains(result.Output || '', 'Key pressed', 'Should confirm key press');
      })
    },

    {
      name: 'Basic Key Release',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.keyRelease(DOOM_KEYS.FORWARD);
        TestRunner.expect.noError(result, 'Key release should not produce errors');
        TestRunner.expect.contains(result.Output || '', 'Key released', 'Should confirm key release');
      })
    },

    {
      name: 'Key Tap Sequence',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.keyTap(DOOM_KEYS.FORWARD, 100);
        TestRunner.expect.noError(result.press, 'Key press should not produce errors');
        TestRunner.expect.noError(result.release, 'Key release should not produce errors');
      })
    },

    {
      name: 'Movement Keys Test',
      fn: TestRunner.createAsyncTest(async () => {
        const movementKeys = [
          DOOM_KEYS.FORWARD,
          DOOM_KEYS.BACKWARD,
          DOOM_KEYS.TURN_LEFT,
          DOOM_KEYS.TURN_RIGHT,
          DOOM_KEYS.STRAFE_LEFT,
          DOOM_KEYS.STRAFE_RIGHT
        ];

        for (const key of movementKeys) {
          const result = await client.keyTap(key, 50);
          TestRunner.expect.noError(result.press, `Movement key ${key} press should work`);
          TestRunner.expect.noError(result.release, `Movement key ${key} release should work`);
          
          // Small delay between key tests
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      })
    },

    {
      name: 'Action Keys Test',
      fn: TestRunner.createAsyncTest(async () => {
        const actionKeys = [
          DOOM_KEYS.FIRE,
          DOOM_KEYS.USE,
          DOOM_KEYS.RUN
        ];

        for (const key of actionKeys) {
          const result = await client.keyTap(key, 50);
          TestRunner.expect.noError(result.press, `Action key ${key} press should work`);
          TestRunner.expect.noError(result.release, `Action key ${key} release should work`);
          
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      })
    },

    {
      name: 'Weapon Selection Keys',
      fn: TestRunner.createAsyncTest(async () => {
        const weaponKeys = [
          DOOM_KEYS.WEAPON_1,
          DOOM_KEYS.WEAPON_2,
          DOOM_KEYS.WEAPON_3,
          DOOM_KEYS.WEAPON_4,
          DOOM_KEYS.WEAPON_5
        ];

        for (const key of weaponKeys) {
          const result = await client.keyTap(key, 50);
          TestRunner.expect.noError(result.press, `Weapon key ${key} press should work`);
          TestRunner.expect.noError(result.release, `Weapon key ${key} release should work`);
          
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      })
    },

    {
      name: 'Rapid Key Input Test',
      fn: TestRunner.createAsyncTest(async () => {
        const rapidCount = 10;
        const results: any[] = [];

        for (let i = 0; i < rapidCount; i++) {
          const result = await client.keyTap(DOOM_KEYS.FIRE, 20);
          results.push(result);
        }

        // All rapid inputs should succeed
        const failedInputs = results.filter(r => r.press.Error || r.release.Error);
        TestRunner.expect.equal(
          failedInputs.length, 
          0, 
          `All rapid inputs should succeed, but ${failedInputs.length} failed`
        );
      })
    },

    {
      name: 'Simultaneous Key Press Test',
      fn: TestRunner.createAsyncTest(async () => {
        // Press multiple keys simultaneously
        const pressPromises = [
          client.keyPress(DOOM_KEYS.FORWARD),
          client.keyPress(DOOM_KEYS.STRAFE_LEFT),
          client.keyPress(DOOM_KEYS.RUN)
        ];

        const pressResults = await Promise.all(pressPromises);
        pressResults.forEach((result, index) => {
          TestRunner.expect.noError(result, `Simultaneous key press ${index} should succeed`);
        });

        // Process some ticks while keys are held
        await client.runTicks(5, 16);

        // Release all keys
        const releasePromises = [
          client.keyRelease(DOOM_KEYS.FORWARD),
          client.keyRelease(DOOM_KEYS.STRAFE_LEFT),
          client.keyRelease(DOOM_KEYS.RUN)
        ];

        const releaseResults = await Promise.all(releasePromises);
        releaseResults.forEach((result, index) => {
          TestRunner.expect.noError(result, `Simultaneous key release ${index} should succeed`);
        });
      })
    },

    {
      name: 'Input with Game Ticks',
      fn: TestRunner.createAsyncTest(async () => {
        // Test input while game is actively ticking
        const inputPromise = client.keyTap(DOOM_KEYS.FORWARD, 200);
        const tickPromise = client.runTicks(10, 16);

        const [inputResult, tickResults] = await Promise.all([inputPromise, tickPromise]);

        TestRunner.expect.noError(inputResult.press, 'Input during ticks should work');
        TestRunner.expect.noError(inputResult.release, 'Input release during ticks should work');
        TestRunner.expect.equal(tickResults.length, 10, 'All ticks should complete');
      })
    },

    {
      name: 'Invalid Key Handling',
      fn: TestRunner.createAsyncTest(async () => {
        const invalidKeys = ['InvalidKey', 'NonexistentButton', ''];

        for (const key of invalidKeys) {
          try {
            const result = await client.keyPress(key);
            // Invalid keys might not cause errors, just log the behavior
            logger.debug(`Invalid key "${key}" behavior`, { result: result.Output });
          } catch (error) {
            // It's acceptable for invalid keys to throw errors
            logger.debug(`Invalid key "${key}" threw error: ${error.message}`);
          }
        }
      })
    },

    {
      name: 'Input Performance Test',
      fn: TestRunner.createAsyncTest(async () => {
        const inputCount = 50;
        const startTime = Date.now();

        for (let i = 0; i < inputCount; i++) {
          await client.keyTap(DOOM_KEYS.FIRE, 10);
        }

        const duration = Date.now() - startTime;
        const avgInputTime = duration / inputCount;

        // Input should be reasonably fast
        TestRunner.expect.performance(avgInputTime, 200, 'Average input processing time');
        
        logger.info(`Input performance: ${inputCount} inputs in ${duration}ms (avg: ${avgInputTime.toFixed(2)}ms)`);
      }),
      options: { slow: true }
    },

    {
      name: 'Input State Consistency',
      fn: TestRunner.createAsyncTest(async () => {
        // Test that key states are properly managed
        
        // Press a key
        await client.keyPress(DOOM_KEYS.FORWARD);
        
        // Process some ticks
        const tickResults = await client.runTicks(5, 16);
        
        // All ticks should succeed while key is held
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'No ticks should fail while key is held');
        
        // Release the key
        await client.keyRelease(DOOM_KEYS.FORWARD);
        
        // Process more ticks
        const moreTicks = await client.runTicks(5, 16);
        const moreFailedTicks = moreTicks.filter(r => r.Error);
        TestRunner.expect.equal(moreFailedTicks.length, 0, 'No ticks should fail after key release');
      })
    }
  ];

  const suite = await runner.runSuite('DOOM Input Tests', tests);
  
  // Cleanup
  await client.cleanup();
  
  if (suite.failedTests > 0) {
    throw new Error(`Input tests failed: ${suite.failedTests}/${suite.totalTests} tests failed`);
  }
  
  logger.info('✅ All input tests passed successfully');
}

// Allow running this test suite directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runInputTests()
    .then(() => {
      logger.info('🎉 Input test suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Input test suite failed', { error: error.message });
      process.exit(1);
    });
}
