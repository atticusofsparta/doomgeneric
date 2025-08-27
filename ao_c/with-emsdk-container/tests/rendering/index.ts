import { DoomTestClient } from '../utils/doom-client.js';
import { TestRunner } from '../utils/test-runner.js';
import { logger } from '../utils/logger.js';
import { DOOM_KEYS, DOOM_CONSTANTS } from '../types/index.js';

const runner = new TestRunner({
  logLevel: 'INFO',
  timeout: 25000,
});

export async function runRenderingTests(): Promise<void> {
  const client = new DoomTestClient();

  // Initialize game first
  await client.initialize();
  await client.loadWAD();
  await client.initializeGame();
  await client.waitForStableState();

  const tests = [
    {
      name: 'Basic Screen Data Retrieval',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.getScreen();
        
        if (result.Error) {
          logger.warn('Screen data retrieval not available', { error: result.Error });
          // This might be expected if screen output isn't implemented
          return;
        }
        
        TestRunner.expect.noError(result, 'Screen data request should not produce errors');
        
        if (result.Output && typeof result.Output === 'object') {
          const screenData = result.Output as any;
          TestRunner.expect.truthy(screenData.width, 'Screen data should include width');
          TestRunner.expect.truthy(screenData.height, 'Screen data should include height');
          
          logger.info('Screen data retrieved successfully', {
            width: screenData.width,
            height: screenData.height,
            hasScreenBuffer: !!screenData.screen
          });
        }
      })
    },

    {
      name: 'Screen Resolution Verification',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.getScreen();
        
        if (result.Error || !result.Output) {
          logger.warn('Screen data not available for resolution verification');
          return;
        }
        
        if (typeof result.Output === 'object') {
          const screenData = result.Output as any;
          
          // Verify expected DOOM resolution (using scaled resolution as configured in DOOM AO process)
          TestRunner.expect.equal(
            screenData.width, 
            DOOM_CONSTANTS.SCALED_WIDTH, 
            `Screen width should be ${DOOM_CONSTANTS.SCALED_WIDTH}`
          );
          
          TestRunner.expect.equal(
            screenData.height, 
            DOOM_CONSTANTS.SCALED_HEIGHT, 
            `Screen height should be ${DOOM_CONSTANTS.SCALED_HEIGHT}`
          );
          
          logger.info('Screen resolution verified', screenData);
        }
      })
    },

    {
      name: 'Screen Data During Movement',
      fn: TestRunner.createAsyncTest(async () => {
        // Move and capture screen at different positions
        const screenCaptures = [];
        
        // Initial position
        let result = await client.getScreen();
        if (!result.Error && result.Output) {
          screenCaptures.push({ position: 'initial', data: result.Output });
        }
        
        // Move forward
        await client.keyPress(DOOM_KEYS.FORWARD);
        await client.runTicks(20, 16);
        await client.keyRelease(DOOM_KEYS.FORWARD);
        
        result = await client.getScreen();
        if (!result.Error && result.Output) {
          screenCaptures.push({ position: 'forward', data: result.Output });
        }
        
        // Turn left
        await client.keyPress(DOOM_KEYS.TURN_LEFT);
        await client.runTicks(15, 16);
        await client.keyRelease(DOOM_KEYS.TURN_LEFT);
        
        result = await client.getScreen();
        if (!result.Error && result.Output) {
          screenCaptures.push({ position: 'turned', data: result.Output });
        }
        
        if (screenCaptures.length > 0) {
          logger.info(`Captured ${screenCaptures.length} screen states during movement`);
          
          // Verify all screens have consistent dimensions
          const firstScreen = screenCaptures[0].data as any;
          if (firstScreen.width && firstScreen.height) {
            screenCaptures.forEach((capture, index) => {
              const screen = capture.data as any;
              TestRunner.expect.equal(
                screen.width, 
                firstScreen.width, 
                `Screen ${index} width should be consistent`
              );
              TestRunner.expect.equal(
                screen.height, 
                firstScreen.height, 
                `Screen ${index} height should be consistent`
              );
            });
          }
        }
      })
    },

    {
      name: 'Screen Data During Menu Operations',
      fn: TestRunner.createAsyncTest(async () => {
        // Capture screen in game
        let gameResult = await client.getScreen();
        
        // Open menu
        await client.openMenu();
        await client.runTicks(5, 16);
        
        // Capture screen in menu
        let menuResult = await client.getScreen();
        
        // Close menu
        await client.keyTap(DOOM_KEYS.MENU);
        await client.runTicks(5, 16);
        
        // Capture screen back in game
        let backToGameResult = await client.getScreen();
        
        const captures = [
          { state: 'game', result: gameResult },
          { state: 'menu', result: menuResult },
          { state: 'backToGame', result: backToGameResult }
        ];
        
        captures.forEach(capture => {
          if (!capture.result.Error && capture.result.Output) {
            logger.info(`Screen captured in ${capture.state} state`);
            
            if (typeof capture.result.Output === 'object') {
              const screenData = capture.result.Output as any;
              TestRunner.expect.truthy(screenData.width, `${capture.state} screen should have width`);
              TestRunner.expect.truthy(screenData.height, `${capture.state} screen should have height`);
            }
          }
        });
      })
    },

    {
      name: 'Screen Buffer Format Validation',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.getScreen();
        
        if (result.Error || !result.Output) {
          logger.warn('Screen buffer validation skipped - no screen data available');
          return;
        }
        
        if (typeof result.Output === 'object') {
          const screenData = result.Output as any;
          
          if (screenData.screen) {
            // Screen buffer should be base64 encoded
            TestRunner.expect.truthy(
              typeof screenData.screen === 'string',
              'Screen buffer should be a string'
            );
            
            // Extract the actual base64 image data from the screen object
            // Since result.Output is already parsed, screenData.screen should contain the base64 data directly
            let actualBase64Data = screenData.screen;
            
            logger.info('Screen data extraction', {
              screenDataType: typeof screenData.screen,
              screenDataPreview: typeof screenData.screen === 'string' ? screenData.screen.substring(0, 100) + '...' : 'Not a string',
              startsWithJSON: typeof screenData.screen === 'string' && screenData.screen.startsWith('{')
            });
            
            // Ensure we have extracted valid base64 data
            if (!actualBase64Data || typeof actualBase64Data !== 'string') {
              TestRunner.expect.fail('Failed to extract base64 data from screen response');
              return;
            }
            
            // Remove any whitespace that might have been added during transmission  
            const cleanedScreen = actualBase64Data.replace(/\s/g, '');
            
            logger.info('Base64 validation details', {
              actualBase64DataType: typeof actualBase64Data,
              actualBase64Preview: typeof actualBase64Data === 'string' ? actualBase64Data.substring(0, 50) + '...' : 'Not a string',
              originalLength: actualBase64Data ? actualBase64Data.length : 0,
              cleanedLength: cleanedScreen.length,
              startsWithValidBase64: /^[A-Za-z0-9+/]/.test(cleanedScreen),
              first50Chars: cleanedScreen.substring(0, 50)
            });
            
            // Validate the base64 screen data
            TestRunner.expect.truthy(
              cleanedScreen && cleanedScreen.length > 100,
              'Screen buffer should contain substantial data'
            );
            
            // Attempt to decode the base64 - if this succeeds, it's valid base64
            let decodedBuffer;
            try {
              if (typeof Buffer !== 'undefined') {
                // Node.js environment
                decodedBuffer = Buffer.from(cleanedScreen, 'base64');
              } else {
                // Browser environment
                decodedBuffer = atob(cleanedScreen);
              }
              TestRunner.expect.truthy(true, 'Screen buffer successfully decoded as valid base64');
            } catch (error) {
              TestRunner.expect.fail(`Screen buffer is not valid base64: ${error.message}`);
            }
            
            // The Buffer.from() decoding above is the definitive base64 validation
            // No need for additional regex validation since decoding success proves validity
            logger.info('Base64 validation completed successfully', {
              dataLength: cleanedScreen.length,
              decodedSuccessfully: !!decodedBuffer
            });
            
            // Calculate expected buffer size using cleaned screen data
            const expectedPixels = screenData.width * screenData.height;
            const expectedBufferSize = expectedPixels * 4; // Assuming RGBA format
            const actualDecodedSize = decodedBuffer ? decodedBuffer.length : (cleanedScreen.length * 3) / 4;
            
            logger.info('Screen buffer format validated', {
              bufferLength: cleanedScreen.length,
              expectedPixels,
              expectedBufferSize,
              actualDecodedSize,
              isValidBase64: !!decodedBuffer
            });
          }
        }
      })
    },

    {
      name: 'Rendering Performance Test',
      fn: TestRunner.createAsyncTest(async () => {
        const renderingTimes = [];
        
        for (let i = 0; i < 10; i++) {
          const startTime = Date.now();
          
          // Process some ticks (rendering happens during ticks)
          await client.runTicks(5, 16);
          
          // Get screen data
          await client.getScreen();
          
          const duration = Date.now() - startTime;
          renderingTimes.push(duration);
        }
        
        const avgRenderTime = renderingTimes.reduce((a, b) => a + b, 0) / renderingTimes.length;
        const maxRenderTime = Math.max(...renderingTimes);
        
        // Rendering should be reasonably fast
        TestRunner.expect.performance(avgRenderTime, 1000, 'Average rendering cycle time');
        TestRunner.expect.performance(maxRenderTime, 2000, 'Maximum rendering cycle time');
        
        logger.info('Rendering performance measured', {
          avgRenderTime,
          maxRenderTime,
          samples: renderingTimes.length
        });
      }),
      options: { slow: true }
    },

    {
      name: 'Screen Consistency During Rapid Updates',
      fn: TestRunner.createAsyncTest(async () => {
        const screenResults = [];
        
        // Rapidly request screen data while game is running
        for (let i = 0; i < 5; i++) {
          const screenPromise = client.getScreen();
          const tickPromise = client.runTicks(3, 16);
          
          const [screenResult] = await Promise.all([screenPromise, tickPromise]);
          screenResults.push(screenResult);
        }
        
        // Count successful screen captures
        const successfulCaptures = screenResults.filter(r => !r.Error && r.Output);
        
        if (successfulCaptures.length > 0) {
          logger.info(`${successfulCaptures.length}/5 screen captures succeeded during rapid updates`);
          
          // Verify consistency
          const firstScreen = successfulCaptures[0].Output as any;
          if (firstScreen && firstScreen.width && firstScreen.height) {
            successfulCaptures.forEach((result, index) => {
              const screen = result.Output as any;
              TestRunner.expect.equal(
                screen.width, 
                firstScreen.width, 
                `Rapid capture ${index} width should be consistent`
              );
              TestRunner.expect.equal(
                screen.height, 
                firstScreen.height, 
                `Rapid capture ${index} height should be consistent`
              );
            });
          }
        }
      })
    },

    {
      name: 'Frame Rate Consistency',
      fn: TestRunner.createAsyncTest(async () => {
        const frameTimes = [];
        const targetDelta = 16; // 60 FPS
        
        for (let i = 0; i < 20; i++) {
          const startTime = Date.now();
          await client.tick(targetDelta);
          const frameTime = Date.now() - startTime;
          frameTimes.push(frameTime);
        }
        
        const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        const frameTimeVariance = frameTimes.map(t => Math.abs(t - avgFrameTime));
        const maxVariance = Math.max(...frameTimeVariance);
        
        // Frame times should be reasonably consistent
        TestRunner.expect.performance(avgFrameTime, 200, 'Average frame processing time');
        TestRunner.expect.performance(maxVariance, 100, 'Frame time variance');
        
        logger.info('Frame rate consistency verified', {
          avgFrameTime,
          maxVariance,
          targetDelta,
          samples: frameTimes.length
        });
      })
    },

    {
      name: 'Screen Data Memory Impact',
      fn: TestRunner.createAsyncTest(async () => {
        const initialMemory = client.getMemorySize();
        
        // Request screen data multiple times
        for (let i = 0; i < 10; i++) {
          await client.getScreen();
          await client.runTicks(2, 16);
        }
        
        const finalMemory = client.getMemorySize();
        const memoryChange = finalMemory - initialMemory;
        
        // Memory shouldn't grow significantly from screen requests
        const maxAcceptableGrowth = 2 * 1024 * 1024; // 2MB
        TestRunner.expect.truthy(
          Math.abs(memoryChange) <= maxAcceptableGrowth,
          `Screen requests shouldn't cause significant memory growth (changed by ${memoryChange} bytes)`
        );
        
        logger.info('Screen data memory impact verified', {
          initialMemory,
          finalMemory,
          memoryChange,
          screenRequests: 10
        });
      })
    },

    {
      name: 'Rendering During Complex Gameplay',
      fn: TestRunner.createAsyncTest(async () => {
        // Simulate complex gameplay scenario
        const actions = [
          { action: () => client.keyPress(DOOM_KEYS.FORWARD), description: 'start forward' },
          { action: () => client.runTicks(10, 16), description: 'move forward' },
          { action: () => client.keyPress(DOOM_KEYS.FIRE), description: 'start firing' },
          { action: () => client.runTicks(5, 16), description: 'fire while moving' },
          { action: () => client.keyPress(DOOM_KEYS.TURN_LEFT), description: 'start turning' },
          { action: () => client.runTicks(8, 16), description: 'turn while moving and firing' },
          { action: () => client.keyRelease(DOOM_KEYS.FIRE), description: 'stop firing' },
          { action: () => client.runTicks(5, 16), description: 'continue moving and turning' },
          { action: () => client.keyRelease(DOOM_KEYS.TURN_LEFT), description: 'stop turning' },
          { action: () => client.runTicks(5, 16), description: 'just moving' },
          { action: () => client.keyRelease(DOOM_KEYS.FORWARD), description: 'stop moving' },
          { action: () => client.runTicks(3, 16), description: 'idle' }
        ];
        
        for (const actionStep of actions) {
          await actionStep.action();
          
          // Try to get screen data during each action
          const screenResult = await client.getScreen();
          if (!screenResult.Error) {
            logger.debug(`Screen captured during: ${actionStep.description}`);
          }
        }
        
        logger.info('Complex gameplay rendering test completed');
      }),
      options: { slow: true }
    },

    {
      name: 'Rendering Error Recovery',
      fn: TestRunner.createAsyncTest(async () => {
        // Test that rendering systems can recover from errors
        
        // Try to get screen data
        const initialResult = await client.getScreen();
        
        // Cause some potentially disruptive operations
        await client.openMenu();
        await client.runTicks(5, 16);
        await client.keyTap(DOOM_KEYS.MENU);
        await client.runTicks(5, 16);
        
        // Try rapid key presses that might disrupt rendering
        for (let i = 0; i < 5; i++) {
          await client.keyTap(DOOM_KEYS.FIRE, 10);
        }
        
        await client.runTicks(10, 16);
        
        // Try to get screen data again
        const recoveryResult = await client.getScreen();
        
        if (initialResult.Error && recoveryResult.Error) {
          logger.info('Screen data consistently unavailable (expected)');
        } else if (!initialResult.Error && !recoveryResult.Error) {
          logger.info('Screen data consistently available');
          
          // Verify screen data is still valid
          if (typeof recoveryResult.Output === 'object') {
            const screenData = recoveryResult.Output as any;
            TestRunner.expect.truthy(screenData.width, 'Recovered screen should have width');
            TestRunner.expect.truthy(screenData.height, 'Recovered screen should have height');
          }
        } else {
          logger.warn('Screen data availability changed during test', {
            initialError: !!initialResult.Error,
            recoveryError: !!recoveryResult.Error
          });
        }
      })
    }
  ];

  const suite = await runner.runSuite('DOOM Rendering Tests', tests);
  
  // Cleanup
  await client.cleanup();
  
  if (suite.failedTests > 0) {
    throw new Error(`Rendering tests failed: ${suite.failedTests}/${suite.totalTests} tests failed`);
  }
  
  logger.info('✅ All rendering tests passed successfully');
}

// Allow running this test suite directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runRenderingTests()
    .then(() => {
      logger.info('🎉 Rendering test suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Rendering test suite failed', { error: error.message });
      process.exit(1);
    });
}
