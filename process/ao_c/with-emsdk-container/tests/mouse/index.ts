import { DoomTestClient } from '../utils/doom-client.js';
import { TestRunner } from '../utils/test-runner.js';
import { logger } from '../utils/logger.js';
import { DOOM_MOUSE } from '../types/index.js';

const runner = new TestRunner({
  logLevel: 'INFO',
  timeout: 15000,
});

export async function runMouseTests(): Promise<void> {
  const client = new DoomTestClient();

  // Initialize game first
  await client.initialize();
  await client.loadWAD();
  await client.initializeGame();
  await client.waitForStableState();

  const tests = [
    {
      name: 'Basic Mouse Movement',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.mouseMove(10, 5);
        TestRunner.expect.noError(result, 'Mouse movement should not produce errors');
        TestRunner.expect.contains(result.Output || '', 'Mouse moved', 'Should confirm mouse movement');
      })
    },

    {
      name: 'Mouse Movement with Negative Deltas',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.mouseMove(-15, -10);
        TestRunner.expect.noError(result, 'Negative mouse movement should not produce errors');
        TestRunner.expect.contains(result.Output || '', 'Mouse moved', 'Should confirm negative mouse movement');
      })
    },

    {
      name: 'Left Mouse Button Click',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.leftClick();
        TestRunner.expect.noError(result.press, 'Left mouse press should not produce errors');
        TestRunner.expect.noError(result.release, 'Left mouse release should not produce errors');
        TestRunner.expect.contains(result.press.Output || '', 'Mouse clicked', 'Should confirm left mouse press');
        TestRunner.expect.contains(result.release.Output || '', 'Mouse clicked', 'Should confirm left mouse release');
      })
    },

    {
      name: 'Right Mouse Button Click',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.rightClick();
        TestRunner.expect.noError(result.press, 'Right mouse press should not produce errors');
        TestRunner.expect.noError(result.release, 'Right mouse release should not produce errors');
        TestRunner.expect.contains(result.press.Output || '', 'Mouse clicked', 'Should confirm right mouse press');
        TestRunner.expect.contains(result.release.Output || '', 'Mouse clicked', 'Should confirm right mouse release');
      })
    },

    {
      name: 'Middle Mouse Button Click',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.middleClick();
        TestRunner.expect.noError(result.press, 'Middle mouse press should not produce errors');
        TestRunner.expect.noError(result.release, 'Middle mouse release should not produce errors');
        TestRunner.expect.contains(result.press.Output || '', 'Mouse clicked', 'Should confirm middle mouse press');
        TestRunner.expect.contains(result.release.Output || '', 'Mouse clicked', 'Should confirm middle mouse release');
      })
    },

    {
      name: 'Mouse Wheel Up',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.mouseWheelUp();
        TestRunner.expect.noError(result, 'Mouse wheel up should not produce errors');
        TestRunner.expect.contains(result.Output || '', 'Mouse wheel', 'Should confirm mouse wheel up');
      })
    },

    {
      name: 'Mouse Wheel Down',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.mouseWheelDown();
        TestRunner.expect.noError(result, 'Mouse wheel down should not produce errors');
        TestRunner.expect.contains(result.Output || '', 'Mouse wheel', 'Should confirm mouse wheel down');
      })
    },

    {
      name: 'Custom Mouse Wheel Direction',
      fn: TestRunner.createAsyncTest(async () => {
        const upResult = await client.mouseWheel(3);
        const downResult = await client.mouseWheel(-2);
        
        TestRunner.expect.noError(upResult, 'Custom wheel up should not produce errors');
        TestRunner.expect.noError(downResult, 'Custom wheel down should not produce errors');
        TestRunner.expect.contains(upResult.Output || '', 'Mouse wheel', 'Should confirm custom wheel up');
        TestRunner.expect.contains(downResult.Output || '', 'Mouse wheel', 'Should confirm custom wheel down');
      })
    },

    {
      name: 'Mouse Movement with Coordinates',
      fn: TestRunner.createAsyncTest(async () => {
        const movements = [
          { deltaX: 50, deltaY: 0 },   // Move right
          { deltaX: 0, deltaY: 25 },   // Move down  
          { deltaX: -25, deltaY: 0 },  // Move left
          { deltaX: 0, deltaY: -15 }   // Move up
        ];

        for (const move of movements) {
          const result = await client.mouseMove(move.deltaX, move.deltaY);
          TestRunner.expect.noError(result, `Movement (${move.deltaX}, ${move.deltaY}) should work`);
          
          // Small delay between movements
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      })
    },

    {
      name: 'Rapid Mouse Clicks',
      fn: TestRunner.createAsyncTest(async () => {
        const rapidCount = 10;
        const results: any[] = [];

        for (let i = 0; i < rapidCount; i++) {
          const result = await client.leftClick(undefined, undefined, 20); // Fast clicks
          results.push(result);
        }

        // All rapid clicks should succeed
        const failedClicks = results.filter(r => r.press.Error || r.release.Error);
        TestRunner.expect.equal(
          failedClicks.length, 
          0, 
          `All rapid clicks should succeed, but ${failedClicks.length} failed`
        );
      })
    },

    {
      name: 'Mouse Movement Pattern Test',
      fn: TestRunner.createAsyncTest(async () => {
        // Create a circular movement pattern
        const pattern = [
          { deltaX: 10, deltaY: 0, delay: 25 },
          { deltaX: 7, deltaY: 7, delay: 25 },
          { deltaX: 0, deltaY: 10, delay: 25 },
          { deltaX: -7, deltaY: 7, delay: 25 },
          { deltaX: -10, deltaY: 0, delay: 25 },
          { deltaX: -7, deltaY: -7, delay: 25 },
          { deltaX: 0, deltaY: -10, delay: 25 },
          { deltaX: 7, deltaY: -7, delay: 25 }
        ];

        const results = await client.mouseMovePattern(pattern);
        
        const failedMoves = results.filter(r => r.Error);
        TestRunner.expect.equal(
          failedMoves.length, 
          0, 
          `All pattern movements should succeed, but ${failedMoves.length} failed`
        );
        TestRunner.expect.equal(results.length, pattern.length, 'Should complete all pattern movements');
      })
    },

    {
      name: 'Simultaneous Mouse Button Press',
      fn: TestRunner.createAsyncTest(async () => {
        // Press multiple mouse buttons simultaneously
        const pressPromises = [
          client.mousePress(DOOM_MOUSE.LEFT_BUTTON),
          client.mousePress(DOOM_MOUSE.RIGHT_BUTTON),
          client.mousePress(DOOM_MOUSE.MIDDLE_BUTTON)
        ];

        const pressResults = await Promise.all(pressPromises);
        pressResults.forEach((result, index) => {
          TestRunner.expect.noError(result, `Simultaneous mouse press ${index} should succeed`);
        });

        // Process some ticks while buttons are held
        await client.runTicks(3, 16);

        // Release all buttons
        const releasePromises = [
          client.mouseRelease(DOOM_MOUSE.LEFT_BUTTON),
          client.mouseRelease(DOOM_MOUSE.RIGHT_BUTTON),
          client.mouseRelease(DOOM_MOUSE.MIDDLE_BUTTON)
        ];

        const releaseResults = await Promise.all(releasePromises);
        releaseResults.forEach((result, index) => {
          TestRunner.expect.noError(result, `Simultaneous mouse release ${index} should succeed`);
        });
      })
    },

    {
      name: 'Mouse Input with Game Ticks',
      fn: TestRunner.createAsyncTest(async () => {
        // Test mouse input while game is actively ticking
        const mousePromise = client.leftClick(undefined, undefined, 200);
        const tickPromise = client.runTicks(10, 16);

        const [mouseResult, tickResults] = await Promise.all([mousePromise, tickPromise]);

        TestRunner.expect.noError(mouseResult.press, 'Mouse press during ticks should work');
        TestRunner.expect.noError(mouseResult.release, 'Mouse release during ticks should work');
        TestRunner.expect.equal(tickResults.length, 10, 'All ticks should complete');
      })
    },

    {
      name: 'Mixed Input Test (Mouse + Keyboard)',
      fn: TestRunner.createAsyncTest(async () => {
        // Test mixing mouse and keyboard input
        const mixedPromises = [
          client.leftClick(),
          client.keyTap('w', 100), // FORWARD key
          client.mouseMove(15, 10),
          client.rightClick(),
          client.mouseWheelUp()
        ];

        const results = await Promise.allSettled(mixedPromises);
        
        const successfulResults = results.filter(r => r.status === 'fulfilled');
        TestRunner.expect.equal(
          successfulResults.length, 
          mixedPromises.length, 
          'All mixed input actions should succeed'
        );
      })
    },

    {
      name: 'Mouse Button State Consistency',
      fn: TestRunner.createAsyncTest(async () => {
        // Test that mouse button states are properly managed
        
        // Press left mouse button
        await client.mousePress(DOOM_MOUSE.LEFT_BUTTON);
        
        // Process some ticks
        const tickResults = await client.runTicks(5, 16);
        
        // All ticks should succeed while button is held
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'No ticks should fail while mouse button is held');
        
        // Release the button
        await client.mouseRelease(DOOM_MOUSE.LEFT_BUTTON);
        
        // Process more ticks
        const moreTicks = await client.runTicks(5, 16);
        const moreFailedTicks = moreTicks.filter(r => r.Error);
        TestRunner.expect.equal(moreFailedTicks.length, 0, 'No ticks should fail after mouse button release');
      })
    },

    {
      name: 'Mouse Input Performance Test',
      fn: TestRunner.createAsyncTest(async () => {
        const inputCount = 30; // Fewer than keyboard since mouse events might be more expensive
        const startTime = Date.now();

        for (let i = 0; i < inputCount; i++) {
          await client.leftClick(undefined, undefined, 10); // Fast clicks
        }

        const duration = Date.now() - startTime;
        const avgInputTime = duration / inputCount;

        // Mouse input should be reasonably fast
        TestRunner.expect.performance(avgInputTime, 300, 'Average mouse input processing time');
        
        logger.info(`Mouse performance: ${inputCount} inputs in ${duration}ms (avg: ${avgInputTime.toFixed(2)}ms)`);
      }),
      options: { slow: true }
    },

    {
      name: 'Large Mouse Movement Test',
      fn: TestRunner.createAsyncTest(async () => {
        // Test large mouse movements
        const largeMovements = [
          { deltaX: 1000, deltaY: 0 },
          { deltaX: 0, deltaY: 1000 },
          { deltaX: -1000, deltaY: 0 },
          { deltaX: 0, deltaY: -1000 },
          { deltaX: 500, deltaY: 500 },
          { deltaX: -500, deltaY: -500 }
        ];

        for (const move of largeMovements) {
          const result = await client.mouseMove(move.deltaX, move.deltaY);
          TestRunner.expect.noError(result, `Large movement (${move.deltaX}, ${move.deltaY}) should work`);
        }
      })
    },

    {
      name: 'Zero Mouse Movement Test',
      fn: TestRunner.createAsyncTest(async () => {
        // Test zero movement (should still be valid)
        const result = await client.mouseMove(0, 0);
        TestRunner.expect.noError(result, 'Zero mouse movement should not produce errors');
        TestRunner.expect.contains(result.Output || '', 'Mouse moved', 'Should confirm zero mouse movement');
      })
    },

    {
      name: 'Invalid Mouse Button Handling',
      fn: TestRunner.createAsyncTest(async () => {
        // Test invalid mouse button numbers
        const invalidButtons = [-1, 999, 10];

        for (const button of invalidButtons) {
          try {
            const result = await client.mousePress(button);
            // Invalid buttons might not cause errors, just log the behavior
            logger.debug(`Invalid button "${button}" behavior`, { result: result.Output });
          } catch (error) {
            // It's acceptable for invalid buttons to throw errors
            logger.debug(`Invalid button "${button}" threw error: ${error.message}`);
          }
        }
      })
    }
  ];

  const suite = await runner.runSuite('DOOM Mouse Input Tests', tests);
  
  // Cleanup
  await client.cleanup();
  
  if (suite.failedTests > 0) {
    throw new Error(`Mouse tests failed: ${suite.failedTests}/${suite.totalTests} tests failed`);
  }
  
  logger.info('✅ All mouse input tests passed successfully');
}

// Allow running this test suite directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMouseTests()
    .then(() => {
      logger.info('🎉 Mouse test suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Mouse test suite failed', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    });
}
