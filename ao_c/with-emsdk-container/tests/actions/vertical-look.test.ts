import { DoomTestClient } from '../utils/doom-client.js';
import { TestRunner } from '../utils/test-runner.js';
import { logger } from '../utils/logger.js';
import { DOOM_KEYS } from '../types/index.js';

const runner = new TestRunner({
  logLevel: 'INFO',
  timeout: 15000,
});

export async function runVerticalLookActionTest(): Promise<void> {
  const client = new DoomTestClient();

  // Initialize game first
  await client.initialize();
  await client.loadWAD();
  await client.initializeGame();
  await client.waitForStableState();

  const tests = [
    {
      name: 'LOOK UP Action - Basic Test',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.lookUpTap();
        TestRunner.expect.noError(result.press, 'LOOK UP press should not produce errors');
        TestRunner.expect.noError(result.release, 'LOOK UP release should not produce errors');
        TestRunner.expect.contains(result.press.Output || '', 'Key pressed', 'Should confirm LOOK UP press');
        TestRunner.expect.contains(result.release.Output || '', 'Key released', 'Should confirm LOOK UP release');
      })
    },

    {
      name: 'LOOK DOWN Action - Basic Test',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.lookDownTap();
        TestRunner.expect.noError(result.press, 'LOOK DOWN press should not produce errors');
        TestRunner.expect.noError(result.release, 'LOOK DOWN release should not produce errors');
        TestRunner.expect.contains(result.press.Output || '', 'Key pressed', 'Should confirm LOOK DOWN press');
        TestRunner.expect.contains(result.release.Output || '', 'Key released', 'Should confirm LOOK DOWN release');
      })
    },

    {
      name: 'LOOK UP Press and Release Methods',
      fn: TestRunner.createAsyncTest(async () => {
        // Test individual press/release methods
        const pressResult = await client.lookUpPress();
        TestRunner.expect.noError(pressResult, 'lookUpPress should work');
        TestRunner.expect.contains(pressResult.Output || '', 'Key pressed', 'Should confirm press');
        
        // Process ticks while looking up
        await client.runTicks(2, 16);
        
        const releaseResult = await client.lookUpRelease();
        TestRunner.expect.noError(releaseResult, 'lookUpRelease should work');
        TestRunner.expect.contains(releaseResult.Output || '', 'Key released', 'Should confirm release');
      })
    },

    {
      name: 'LOOK DOWN Press and Release Methods',
      fn: TestRunner.createAsyncTest(async () => {
        // Test individual press/release methods
        const pressResult = await client.lookDownPress();
        TestRunner.expect.noError(pressResult, 'lookDownPress should work');
        TestRunner.expect.contains(pressResult.Output || '', 'Key pressed', 'Should confirm press');
        
        // Process ticks while looking down
        await client.runTicks(2, 16);
        
        const releaseResult = await client.lookDownRelease();
        TestRunner.expect.noError(releaseResult, 'lookDownRelease should work');
        TestRunner.expect.contains(releaseResult.Output || '', 'Key released', 'Should confirm release');
      })
    },

    {
      name: 'Vertical Look with Different Durations',
      fn: TestRunner.createAsyncTest(async () => {
        // Test different hold durations
        const durations = [50, 100, 200];
        
        for (const duration of durations) {
          const upResult = await client.lookUpTap(duration);
          TestRunner.expect.noError(upResult.press, `Look up with ${duration}ms duration should work`);
          TestRunner.expect.noError(upResult.release, `Look up release with ${duration}ms duration should work`);
          
          const downResult = await client.lookDownTap(duration);
          TestRunner.expect.noError(downResult.press, `Look down with ${duration}ms duration should work`);
          TestRunner.expect.noError(downResult.release, `Look down release with ${duration}ms duration should work`);
        }
      })
    },

    {
      name: 'Vertical Look with Movement',
      fn: TestRunner.createAsyncTest(async () => {
        // Test looking while moving forward
        const forwardPromise = client.keyTap(DOOM_KEYS.FORWARD, 200);
        const lookUpPromise = client.lookUpTap(150);
        
        const [forwardResult, lookResult] = await Promise.all([forwardPromise, lookUpPromise]);
        
        TestRunner.expect.noError(forwardResult.press, 'Movement should work with vertical look');
        TestRunner.expect.noError(lookResult.press, 'Vertical look should work with movement');
        
        // Test looking while turning
        const turnPromise = client.keyTap(DOOM_KEYS.TURN_LEFT, 200);
        const lookDownPromise = client.lookDownTap(150);
        
        const [turnResult, lookDownResult] = await Promise.all([turnPromise, lookDownPromise]);
        
        TestRunner.expect.noError(turnResult.press, 'Turning should work with vertical look');
        TestRunner.expect.noError(lookDownResult.press, 'Look down should work with turning');
      })
    },

    {
      name: 'lookVertical Convenience Method',
      fn: TestRunner.createAsyncTest(async () => {
        // Test the convenience method for both directions
        const upResult = await client.lookVertical('up', 100);
        TestRunner.expect.noError(upResult.press, 'lookVertical up should work');
        TestRunner.expect.noError(upResult.release, 'lookVertical up release should work');
        
        const downResult = await client.lookVertical('down', 100);
        TestRunner.expect.noError(downResult.press, 'lookVertical down should work');
        TestRunner.expect.noError(downResult.release, 'lookVertical down release should work');
      })
    },

    {
      name: 'Key Mapping Verification',
      fn: TestRunner.createAsyncTest(async () => {
        // Verify key mappings
        TestRunner.expect.equal(DOOM_KEYS.LOOK_UP, 'Insert', 'LOOK_UP should map to Insert key');
        TestRunner.expect.equal(DOOM_KEYS.LOOK_DOWN, 'Delete', 'LOOK_DOWN should map to Delete key');
        
        // Test direct key usage
        const insertResult = await client.keyTap('Insert', 50);
        TestRunner.expect.noError(insertResult.press, 'Direct Insert key should work');
        
        const deleteResult = await client.keyTap('Delete', 50);
        TestRunner.expect.noError(deleteResult.press, 'Direct Delete key should work');
      })
    },

    {
      name: 'Vertical Look Performance Test',
      fn: TestRunner.createAsyncTest(async () => {
        const lookCount = 8;
        const startTime = Date.now();

        for (let i = 0; i < lookCount; i++) {
          const direction = i % 2 === 0 ? 'up' : 'down';
          await client.lookVertical(direction, 50);
        }

        const duration = Date.now() - startTime;
        const avgTime = duration / lookCount;

        TestRunner.expect.performance(avgTime, 100, 'Average vertical look time');
        logger.info(`Vertical look performance: ${lookCount} looks in ${duration}ms (avg: ${avgTime.toFixed(2)}ms)`);
      })
    },

    {
      name: 'Vertical Look with Combat Actions',
      fn: TestRunner.createAsyncTest(async () => {
        // Test looking while firing
        const firePromise = client.keyTap(DOOM_KEYS.FIRE, 100);
        const lookUpPromise = client.lookUpTap(80);
        
        const [fireResult, lookResult] = await Promise.all([firePromise, lookUpPromise]);
        
        TestRunner.expect.noError(fireResult.press, 'Firing should work with vertical look');
        TestRunner.expect.noError(lookResult.press, 'Vertical look should work while firing');
        
        // Test looking while weapon switching
        const weaponPromise = client.nextWeapon();
        const lookDownPromise = client.lookDownTap(80);
        
        const [weaponResult, lookDownResult] = await Promise.all([weaponPromise, lookDownPromise]);
        
        TestRunner.expect.noError(weaponResult.press, 'Weapon switching should work with vertical look');
        TestRunner.expect.noError(lookDownResult.press, 'Look down should work while switching weapons');
      })
    },

    {
      name: 'Vertical Look with Other Actions Integration',
      fn: TestRunner.createAsyncTest(async () => {
        // Test with strafe
        await client.strafePress();
        const lookWithStrafe = await client.lookUpTap();
        TestRunner.expect.noError(lookWithStrafe.press, 'Vertical look should work while strafing');
        await client.strafeRelease();
        
        // Test with autorun
        await client.autorunToggle();
        const lookWithAutorun = await client.lookDownTap();
        TestRunner.expect.noError(lookWithAutorun.press, 'Vertical look should work with autorun');
        await client.autorunToggle(); // Turn off autorun
        
        // Test with automap
        await client.automapToggle();
        const lookWithAutomap = await client.lookUpTap();
        TestRunner.expect.noError(lookWithAutomap.press, 'Vertical look should work with automap open');
        await client.automapToggle(); // Close automap
      })
    },

    {
      name: 'Rapid Vertical Look Test',
      fn: TestRunner.createAsyncTest(async () => {
        // Test rapid alternating vertical look
        const rapidCount = 6;
        
        for (let i = 0; i < rapidCount; i++) {
          const direction = i % 2 === 0 ? 'up' : 'down';
          const result = await client.lookVertical(direction, 30);
          TestRunner.expect.noError(result.press, `Rapid vertical look ${direction} ${i + 1} should work`);
          
          // Very short delay for rapid testing
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      })
    },

    {
      name: 'Sustained Vertical Look Test',
      fn: TestRunner.createAsyncTest(async () => {
        // Test holding look up for extended period
        await client.lookUpPress();
        
        // Process several ticks while looking up
        const tickResults = await client.runTicks(5, 16);
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'No ticks should fail while looking up');
        
        await client.lookUpRelease();
        
        // Test holding look down for extended period
        await client.lookDownPress();
        
        // Process ticks while looking down
        const moreTicks = await client.runTicks(5, 16);
        const moreFailedTicks = moreTicks.filter(r => r.Error);
        TestRunner.expect.equal(moreFailedTicks.length, 0, 'No ticks should fail while looking down');
        
        await client.lookDownRelease();
      })
    },

    {
      name: 'Vertical Look State Consistency',
      fn: TestRunner.createAsyncTest(async () => {
        // Test that look state doesn't interfere with saves/loads
        await client.lookUpPress();
        
        // Quicksave while looking up
        const saveResult = await client.quicksave();
        TestRunner.expect.noError(saveResult.press, 'Quicksave should work while looking up');
        
        await client.lookUpRelease();
        await client.runTicks(2, 16);
        
        // Look down, then quickload
        await client.lookDownPress();
        const loadResult = await client.quickload();
        TestRunner.expect.noError(loadResult.press, 'Quickload should work while looking down');
        
        await client.lookDownRelease();
      })
    }
  ];

  const suite = await runner.runSuite('DOOM Vertical Look Action Tests', tests);
  
  // Cleanup
  await client.cleanup();
  
  if (suite.failedTests > 0) {
    throw new Error(`Vertical look action tests failed: ${suite.failedTests}/${suite.totalTests} tests failed`);
  }
  
  logger.info('✅ All vertical look action tests passed successfully');
}

// Allow running this test directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runVerticalLookActionTest()
    .then(() => {
      logger.info('🎉 Vertical look action test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Vertical look action test failed', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    });
}
