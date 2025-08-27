import { DoomTestClient } from '../utils/doom-client.js';
import { TestRunner } from '../utils/test-runner.js';
import { logger } from '../utils/logger.js';
import { DOOM_KEYS } from '../types/index.js';

const runner = new TestRunner({
  logLevel: 'INFO',
  timeout: 15000,
});

export async function runCenterViewActionTest(): Promise<void> {
  const client = new DoomTestClient();

  // Initialize game first
  await client.initialize();
  await client.loadWAD();
  await client.initializeGame();
  await client.waitForStableState();

  const tests = [
    {
      name: 'CENTER VIEW Action - Basic Test',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.centerView();
        TestRunner.expect.noError(result.press, 'CENTER VIEW press should not produce errors');
        TestRunner.expect.noError(result.release, 'CENTER VIEW release should not produce errors');
        TestRunner.expect.contains(result.press.Output || '', 'Key pressed', 'Should confirm CENTER VIEW press');
        TestRunner.expect.contains(result.release.Output || '', 'Key released', 'Should confirm CENTER VIEW release');
      })
    },

    {
      name: 'CENTER VIEW Alternative Method Names',
      fn: TestRunner.createAsyncTest(async () => {
        // Test centerLook method
        const centerLookResult = await client.centerLook();
        TestRunner.expect.noError(centerLookResult.press, 'centerLook should work');
        TestRunner.expect.noError(centerLookResult.release, 'centerLook release should work');
        
        // Test resetView method
        const resetViewResult = await client.resetView();
        TestRunner.expect.noError(resetViewResult.press, 'resetView should work');
        TestRunner.expect.noError(resetViewResult.release, 'resetView release should work');
        
        // Test recenterView method
        const recenterViewResult = await client.recenterView();
        TestRunner.expect.noError(recenterViewResult.press, 'recenterView should work');
        TestRunner.expect.noError(recenterViewResult.release, 'recenterView release should work');
      })
    },

    {
      name: 'CENTER VIEW after Look Up',
      fn: TestRunner.createAsyncTest(async () => {
        // Look up first
        await client.lookUpTap(100);
        
        // Process some ticks to let look state settle
        await client.runTicks(2, 16);
        
        // Then center view
        const centerResult = await client.centerView();
        TestRunner.expect.noError(centerResult.press, 'CENTER VIEW after look up should work');
        TestRunner.expect.noError(centerResult.release, 'CENTER VIEW release after look up should work');
      })
    },

    {
      name: 'CENTER VIEW after Look Down',
      fn: TestRunner.createAsyncTest(async () => {
        // Look down first
        await client.lookDownTap(100);
        
        // Process some ticks to let look state settle
        await client.runTicks(2, 16);
        
        // Then center view
        const centerResult = await client.centerView();
        TestRunner.expect.noError(centerResult.press, 'CENTER VIEW after look down should work');
        TestRunner.expect.noError(centerResult.release, 'CENTER VIEW release after look down should work');
      })
    },

    {
      name: 'CENTER VIEW with Complex Look Sequence',
      fn: TestRunner.createAsyncTest(async () => {
        // Perform a complex sequence of look actions
        await client.lookUpTap(80);
        await client.lookDownTap(60);
        await client.lookUpTap(120);
        
        // Process ticks
        await client.runTicks(3, 16);
        
        // Center view to reset everything
        const centerResult = await client.centerView();
        TestRunner.expect.noError(centerResult.press, 'CENTER VIEW after complex sequence should work');
        
        // Verify we can look normally after centering
        const lookAfterCenter = await client.lookDownTap(50);
        TestRunner.expect.noError(lookAfterCenter.press, 'Looking should work normally after centering');
      })
    },

    {
      name: 'CENTER VIEW with Movement',
      fn: TestRunner.createAsyncTest(async () => {
        // Look up while moving
        const lookPromise = client.lookUpTap(150);
        const movePromise = client.keyTap(DOOM_KEYS.FORWARD, 200);
        
        await Promise.all([lookPromise, movePromise]);
        
        // Center view while still potentially moving
        const centerPromise = client.centerView();
        const turnPromise = client.keyTap(DOOM_KEYS.TURN_LEFT, 100);
        
        const [centerResult, turnResult] = await Promise.all([centerPromise, turnPromise]);
        
        TestRunner.expect.noError(centerResult.press, 'CENTER VIEW should work with movement');
        TestRunner.expect.noError(turnResult.press, 'Movement should work with CENTER VIEW');
      })
    },

    {
      name: 'Key Mapping Verification',
      fn: TestRunner.createAsyncTest(async () => {
        // Verify key mapping
        TestRunner.expect.equal(DOOM_KEYS.CENTER_VIEW, 'End', 'CENTER_VIEW should map to End key');
        
        // Test direct End key usage
        const endResult = await client.keyTap('End', 50);
        TestRunner.expect.noError(endResult.press, 'Direct End key should work');
        TestRunner.expect.noError(endResult.release, 'Direct End key release should work');
      })
    },

    {
      name: 'CENTER VIEW Performance Test',
      fn: TestRunner.createAsyncTest(async () => {
        const centerCount = 6;
        const startTime = Date.now();

        for (let i = 0; i < centerCount; i++) {
          // Alternate between looking and centering
          if (i % 2 === 0) {
            await client.lookUpTap(30);
          } else {
            await client.lookDownTap(30);
          }
          
          await client.centerView();
        }

        const duration = Date.now() - startTime;
        const avgTime = duration / centerCount;

        TestRunner.expect.performance(avgTime, 150, 'Average CENTER VIEW time');
        logger.info(`CENTER VIEW performance: ${centerCount} centers in ${duration}ms (avg: ${avgTime.toFixed(2)}ms)`);
      })
    },

    {
      name: 'CENTER VIEW with Combat Actions',
      fn: TestRunner.createAsyncTest(async () => {
        // Look up and fire
        await client.lookUpTap(80);
        
        const firePromise = client.keyTap(DOOM_KEYS.FIRE, 100);
        const centerPromise = client.centerView();
        
        const [fireResult, centerResult] = await Promise.all([firePromise, centerPromise]);
        
        TestRunner.expect.noError(fireResult.press, 'Firing should work with CENTER VIEW');
        TestRunner.expect.noError(centerResult.press, 'CENTER VIEW should work while firing');
        
        // Test with weapon switching
        await client.lookDownTap(80);
        
        const weaponPromise = client.nextWeapon();
        const centerPromise2 = client.centerView();
        
        const [weaponResult, centerResult2] = await Promise.all([weaponPromise, centerPromise2]);
        
        TestRunner.expect.noError(weaponResult.press, 'Weapon switching should work with CENTER VIEW');
        TestRunner.expect.noError(centerResult2.press, 'CENTER VIEW should work with weapon switching');
      })
    },

    {
      name: 'CENTER VIEW with Other Actions Integration',
      fn: TestRunner.createAsyncTest(async () => {
        // Test with strafe
        await client.strafePress();
        await client.lookUpTap(60);
        const centerWithStrafe = await client.centerView();
        TestRunner.expect.noError(centerWithStrafe.press, 'CENTER VIEW should work while strafing');
        await client.strafeRelease();
        
        // Test with autorun
        await client.autorunToggle();
        await client.lookDownTap(60);
        const centerWithAutorun = await client.centerView();
        TestRunner.expect.noError(centerWithAutorun.press, 'CENTER VIEW should work with autorun');
        await client.autorunToggle(); // Turn off autorun
        
        // Test with automap
        await client.automapToggle();
        await client.lookUpTap(60);
        const centerWithAutomap = await client.centerView();
        TestRunner.expect.noError(centerWithAutomap.press, 'CENTER VIEW should work with automap open');
        await client.automapToggle(); // Close automap
      })
    },

    {
      name: 'Rapid CENTER VIEW Test',
      fn: TestRunner.createAsyncTest(async () => {
        // Test rapid centering with interspersed look actions
        const rapidCount = 8;
        
        for (let i = 0; i < rapidCount; i++) {
          // Quick look action
          const direction = i % 2 === 0 ? 'up' : 'down';
          await client.lookVertical(direction, 25);
          
          // Rapid center
          const centerResult = await client.centerView();
          TestRunner.expect.noError(centerResult.press, `Rapid CENTER VIEW ${i + 1} should work`);
          
          // Very short delay
          await new Promise(resolve => setTimeout(resolve, 15));
        }
      })
    },

    {
      name: 'CENTER VIEW State Persistence',
      fn: TestRunner.createAsyncTest(async () => {
        // Look up and save
        await client.lookUpTap(100);
        const saveResult = await client.quicksave();
        TestRunner.expect.noError(saveResult.press, 'Quicksave after look up should work');
        
        await client.runTicks(2, 16);
        
        // Center view and test persistence
        await client.centerView();
        
        // Process several ticks after centering
        const tickResults = await client.runTicks(5, 16);
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'No ticks should fail after centering view');
        
        // Quickload and center again
        const loadResult = await client.quickload();
        TestRunner.expect.noError(loadResult.press, 'Quickload should work');
        
        await client.runTicks(2, 16);
        
        const centerAfterLoad = await client.centerView();
        TestRunner.expect.noError(centerAfterLoad.press, 'CENTER VIEW should work after quickload');
      })
    },

    {
      name: 'Complete Vertical Look System Integration',
      fn: TestRunner.createAsyncTest(async () => {
        // Test the complete vertical look system: up, down, center
        
        // Look up
        const upResult = await client.lookUpTap(80);
        TestRunner.expect.noError(upResult.press, 'Look up should work in complete system');
        
        // Look down
        const downResult = await client.lookDownTap(80);
        TestRunner.expect.noError(downResult.press, 'Look down should work in complete system');
        
        // Center view
        const centerResult = await client.centerView();
        TestRunner.expect.noError(centerResult.press, 'Center view should work in complete system');
        
        // Test sequence: up -> center -> down -> center
        await client.lookUpTap(60);
        await client.centerView();
        await client.lookDownTap(60);
        const finalCenter = await client.centerView();
        TestRunner.expect.noError(finalCenter.press, 'Final center in sequence should work');
        
        logger.info('✅ Complete vertical look system (UP/DOWN/CENTER) working perfectly!');
      })
    }
  ];

  const suite = await runner.runSuite('DOOM CENTER VIEW Action Tests', tests);
  
  // Cleanup
  await client.cleanup();
  
  if (suite.failedTests > 0) {
    throw new Error(`CENTER VIEW action tests failed: ${suite.failedTests}/${suite.totalTests} tests failed`);
  }
  
  logger.info('✅ All CENTER VIEW action tests passed successfully');
}

// Allow running this test directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCenterViewActionTest()
    .then(() => {
      logger.info('🎉 CENTER VIEW action test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 CENTER VIEW action test failed', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    });
}
