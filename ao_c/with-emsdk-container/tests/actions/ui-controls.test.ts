import { DoomTestClient } from '../utils/doom-client.js';
import { TestRunner } from '../utils/test-runner.js';
import { logger } from '../utils/logger.js';
import { DOOM_KEYS } from '../types/index.js';

const runner = new TestRunner({
  logLevel: 'INFO',
  timeout: 15000,
});

export async function runUIControlsActionTest(): Promise<void> {
  const client = new DoomTestClient();

  // Initialize game first
  await client.initialize();
  await client.loadWAD();
  await client.initializeGame();
  await client.waitForStableState();

  const tests = [
    {
      name: 'MESSAGE TOGGLE Action - Basic Test',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.messageToggle();
        TestRunner.expect.noError(result.press, 'MESSAGE TOGGLE press should not produce errors');
        TestRunner.expect.noError(result.release, 'MESSAGE TOGGLE release should not produce errors');
        TestRunner.expect.contains(result.press.Output || '', 'Key pressed', 'Should confirm MESSAGE TOGGLE press');
        TestRunner.expect.contains(result.release.Output || '', 'Key released', 'Should confirm MESSAGE TOGGLE release');
      })
    },

    {
      name: 'MESSAGE TOGGLE Alternative Method Names',
      fn: TestRunner.createAsyncTest(async () => {
        // Test toggleMessages method
        const toggleResult = await client.toggleMessages();
        TestRunner.expect.noError(toggleResult.press, 'toggleMessages should work');
        TestRunner.expect.noError(toggleResult.release, 'toggleMessages release should work');
        
        // Test showMessages method
        const showResult = await client.showMessages();
        TestRunner.expect.noError(showResult.press, 'showMessages should work');
        TestRunner.expect.noError(showResult.release, 'showMessages release should work');
        
        // Test hideMessages method
        const hideResult = await client.hideMessages();
        TestRunner.expect.noError(hideResult.press, 'hideMessages should work');
        TestRunner.expect.noError(hideResult.release, 'hideMessages release should work');
      })
    },

    {
      name: 'SCREEN SIZE INCREASE Action - Basic Test',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.screenSizeIncrease();
        TestRunner.expect.noError(result.press, 'SCREEN SIZE INCREASE press should not produce errors');
        TestRunner.expect.noError(result.release, 'SCREEN SIZE INCREASE release should not produce errors');
        TestRunner.expect.contains(result.press.Output || '', 'Key pressed', 'Should confirm SCREEN SIZE INCREASE press');
        TestRunner.expect.contains(result.release.Output || '', 'Key released', 'Should confirm SCREEN SIZE INCREASE release');
      })
    },

    {
      name: 'SCREEN SIZE DECREASE Action - Basic Test',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.screenSizeDecrease();
        TestRunner.expect.noError(result.press, 'SCREEN SIZE DECREASE press should not produce errors');
        TestRunner.expect.noError(result.release, 'SCREEN SIZE DECREASE release should not produce errors');
        TestRunner.expect.contains(result.press.Output || '', 'Key pressed', 'Should confirm SCREEN SIZE DECREASE press');
        TestRunner.expect.contains(result.release.Output || '', 'Key released', 'Should confirm SCREEN SIZE DECREASE release');
      })
    },

    {
      name: 'SCREEN SIZE Alternative Method Names',
      fn: TestRunner.createAsyncTest(async () => {
        // Test increaseScreenSize method
        const increaseResult = await client.increaseScreenSize();
        TestRunner.expect.noError(increaseResult.press, 'increaseScreenSize should work');
        TestRunner.expect.noError(increaseResult.release, 'increaseScreenSize release should work');
        
        // Test decreaseScreenSize method
        const decreaseResult = await client.decreaseScreenSize();
        TestRunner.expect.noError(decreaseResult.press, 'decreaseScreenSize should work');
        TestRunner.expect.noError(decreaseResult.release, 'decreaseScreenSize release should work');
        
        // Test screenSizePlus method
        const plusResult = await client.screenSizePlus();
        TestRunner.expect.noError(plusResult.press, 'screenSizePlus should work');
        
        // Test screenSizeMinus method
        const minusResult = await client.screenSizeMinus();
        TestRunner.expect.noError(minusResult.press, 'screenSizeMinus should work');
      })
    },

    {
      name: 'adjustScreenSize Convenience Method',
      fn: TestRunner.createAsyncTest(async () => {
        // Test the convenience method for both directions
        const increaseResult = await client.adjustScreenSize('increase');
        TestRunner.expect.noError(increaseResult.press, 'adjustScreenSize increase should work');
        TestRunner.expect.noError(increaseResult.release, 'adjustScreenSize increase release should work');
        
        const decreaseResult = await client.adjustScreenSize('decrease');
        TestRunner.expect.noError(decreaseResult.press, 'adjustScreenSize decrease should work');
        TestRunner.expect.noError(decreaseResult.release, 'adjustScreenSize decrease release should work');
      })
    },

    {
      name: 'Screen Size Sequence Test',
      fn: TestRunner.createAsyncTest(async () => {
        // Test a sequence of screen size adjustments
        const sequence = [
          'increase',
          'increase',
          'decrease',
          'increase',
          'decrease',
          'decrease'
        ] as const;
        
        for (const direction of sequence) {
          const result = await client.adjustScreenSize(direction);
          TestRunner.expect.noError(result.press, `Screen size ${direction} should work in sequence`);
          
          // Small delay between adjustments
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      })
    },

    {
      name: 'Key Mapping Verification',
      fn: TestRunner.createAsyncTest(async () => {
        // Verify key mappings
        TestRunner.expect.equal(DOOM_KEYS.MESSAGE_TOGGLE, 'F8', 'MESSAGE_TOGGLE should map to F8');
        TestRunner.expect.equal(DOOM_KEYS.SCREEN_SIZE_INCREASE, 'Equal', 'SCREEN_SIZE_INCREASE should map to Equal');
        TestRunner.expect.equal(DOOM_KEYS.SCREEN_SIZE_DECREASE, 'Minus', 'SCREEN_SIZE_DECREASE should map to Minus');
        
        // Test direct key usage
        const f8Result = await client.keyTap('F8', 50);
        TestRunner.expect.noError(f8Result.press, 'Direct F8 key should work');
        
        const equalResult = await client.keyTap('Equal', 50);
        TestRunner.expect.noError(equalResult.press, 'Direct Equal key should work');
        
        const minusResult = await client.keyTap('Minus', 50);
        TestRunner.expect.noError(minusResult.press, 'Direct Minus key should work');
      })
    },

    {
      name: 'UI Controls with Movement',
      fn: TestRunner.createAsyncTest(async () => {
        // Test message toggle while moving
        const movePromise = client.keyTap(DOOM_KEYS.FORWARD, 150);
        const messagePromise = client.messageToggle();
        
        const [moveResult, messageResult] = await Promise.all([movePromise, messagePromise]);
        
        TestRunner.expect.noError(moveResult.press, 'Movement should work with message toggle');
        TestRunner.expect.noError(messageResult.press, 'Message toggle should work while moving');
        
        // Test screen size while turning
        const turnPromise = client.keyTap(DOOM_KEYS.TURN_RIGHT, 150);
        const screenPromise = client.screenSizeIncrease();
        
        const [turnResult, screenResult] = await Promise.all([turnPromise, screenPromise]);
        
        TestRunner.expect.noError(turnResult.press, 'Turning should work with screen size change');
        TestRunner.expect.noError(screenResult.press, 'Screen size should work while turning');
      })
    },

    {
      name: 'UI Controls with Combat Actions',
      fn: TestRunner.createAsyncTest(async () => {
        // Test message toggle with firing
        const firePromise = client.keyTap(DOOM_KEYS.FIRE, 100);
        const messagePromise = client.messageToggle();
        
        const [fireResult, messageResult] = await Promise.all([firePromise, messagePromise]);
        
        TestRunner.expect.noError(fireResult.press, 'Firing should work with message toggle');
        TestRunner.expect.noError(messageResult.press, 'Message toggle should work while firing');
        
        // Test screen size with weapon switching
        const weaponPromise = client.nextWeapon();
        const screenPromise = client.screenSizeDecrease();
        
        const [weaponResult, screenResult] = await Promise.all([weaponPromise, screenPromise]);
        
        TestRunner.expect.noError(weaponResult.press, 'Weapon switching should work with screen size');
        TestRunner.expect.noError(screenResult.press, 'Screen size should work with weapon switching');
      })
    },

    {
      name: 'UI Controls with Other Actions Integration',
      fn: TestRunner.createAsyncTest(async () => {
        // Test with automap
        await client.automapToggle();
        const messageWithAutomap = await client.messageToggle();
        TestRunner.expect.noError(messageWithAutomap.press, 'Message toggle should work with automap open');
        
        const screenWithAutomap = await client.screenSizeIncrease();
        TestRunner.expect.noError(screenWithAutomap.press, 'Screen size should work with automap open');
        await client.automapToggle(); // Close automap
        
        // Test with vertical look
        await client.lookUpTap(80);
        const messageWithLook = await client.messageToggle();
        TestRunner.expect.noError(messageWithLook.press, 'Message toggle should work with vertical look');
        
        const screenWithLook = await client.screenSizeDecrease();
        TestRunner.expect.noError(screenWithLook.press, 'Screen size should work with vertical look');
        await client.centerView();
        
        // Test with strafe
        await client.strafePress();
        const messageWithStrafe = await client.messageToggle();
        TestRunner.expect.noError(messageWithStrafe.press, 'Message toggle should work while strafing');
        await client.strafeRelease();
      })
    },

    {
      name: 'UI Controls Performance Test',
      fn: TestRunner.createAsyncTest(async () => {
        const actionCount = 8;
        const startTime = Date.now();

        for (let i = 0; i < actionCount; i++) {
          if (i % 4 === 0) {
            await client.messageToggle();
          } else if (i % 4 === 1) {
            await client.screenSizeIncrease();
          } else if (i % 4 === 2) {
            await client.messageToggle();
          } else {
            await client.screenSizeDecrease();
          }
        }

        const duration = Date.now() - startTime;
        const avgTime = duration / actionCount;

        TestRunner.expect.performance(avgTime, 100, 'Average UI control time');
        logger.info(`UI controls performance: ${actionCount} actions in ${duration}ms (avg: ${avgTime.toFixed(2)}ms)`);
      })
    },

    {
      name: 'Multiple Message Toggles',
      fn: TestRunner.createAsyncTest(async () => {
        // Test multiple rapid message toggles
        const toggleCount = 6;
        
        for (let i = 0; i < toggleCount; i++) {
          const result = await client.messageToggle();
          TestRunner.expect.noError(result.press, `Message toggle ${i + 1} should work`);
          
          // Small delay between toggles
          await new Promise(resolve => setTimeout(resolve, 75));
        }
      })
    },

    {
      name: 'UI Controls State Persistence',
      fn: TestRunner.createAsyncTest(async () => {
        // Test that UI changes persist through game ticks
        await client.messageToggle();
        await client.screenSizeIncrease();
        
        // Process several ticks after UI changes
        const tickResults = await client.runTicks(5, 16);
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'No ticks should fail after UI changes');
        
        // Test UI controls after quicksave/load
        const saveResult = await client.quicksave();
        TestRunner.expect.noError(saveResult.press, 'Quicksave should work after UI changes');
        
        await client.runTicks(2, 16);
        
        const loadResult = await client.quickload();
        TestRunner.expect.noError(loadResult.press, 'Quickload should work');
        
        // Test UI controls still work after load
        const messageAfterLoad = await client.messageToggle();
        TestRunner.expect.noError(messageAfterLoad.press, 'Message toggle should work after quickload');
        
        const screenAfterLoad = await client.screenSizeDecrease();
        TestRunner.expect.noError(screenAfterLoad.press, 'Screen size should work after quickload');
      })
    },

    {
      name: 'Rapid UI Controls Test',
      fn: TestRunner.createAsyncTest(async () => {
        // Test rapid alternating UI controls
        const rapidCount = 10;
        
        for (let i = 0; i < rapidCount; i++) {
          if (i % 3 === 0) {
            const result = await client.messageToggle();
            TestRunner.expect.noError(result.press, `Rapid message toggle ${i + 1} should work`);
          } else if (i % 3 === 1) {
            const result = await client.screenSizeIncrease();
            TestRunner.expect.noError(result.press, `Rapid screen increase ${i + 1} should work`);
          } else {
            const result = await client.screenSizeDecrease();
            TestRunner.expect.noError(result.press, `Rapid screen decrease ${i + 1} should work`);
          }
          
          // Very short delay for rapid testing
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      })
    },

    {
      name: 'Complete UI Control System Integration',
      fn: TestRunner.createAsyncTest(async () => {
        // Test the complete UI system with various combinations
        
        // Start with message toggle
        const messageResult = await client.messageToggle();
        TestRunner.expect.noError(messageResult.press, 'Message toggle should work in complete system');
        
        // Adjust screen size up and down
        await client.screenSizeIncrease();
        await client.screenSizeIncrease();
        await client.screenSizeDecrease();
        
        // Toggle messages again
        const messageResult2 = await client.messageToggle();
        TestRunner.expect.noError(messageResult2.press, 'Second message toggle should work');
        
        // Final screen adjustment
        const finalScreen = await client.adjustScreenSize('decrease');
        TestRunner.expect.noError(finalScreen.press, 'Final screen adjustment should work');
        
        logger.info('✅ Complete UI control system (MESSAGE TOGGLE/SCREEN SIZE) working perfectly!');
      })
    }
  ];

  const suite = await runner.runSuite('DOOM UI Controls Action Tests', tests);
  
  // Cleanup
  await client.cleanup();
  
  if (suite.failedTests > 0) {
    throw new Error(`UI controls action tests failed: ${suite.failedTests}/${suite.totalTests} tests failed`);
  }
  
  logger.info('✅ All UI controls action tests passed successfully');
}

// Allow running this test directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runUIControlsActionTest()
    .then(() => {
      logger.info('🎉 UI controls action test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 UI controls action test failed', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    });
}
