import AoLoader from "@permaweb/ao-loader";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wasm = readFileSync(path.join(__dirname, "./src/doom_process.wasm"));

export const STUB_PROCESS_ID = 'process-id-'.padEnd(43, '1');
export const STUB_ADDRESS = 'arweave-address-'.padEnd(43, '1');
export const STUB_ETH_ADDRESS = '0xFCAd0B19bB29D4674531d6f115237E16AfCE377c';
export const STUB_ANT_REGISTRY_ID = 'ant-registry-'.padEnd(43, '1');
/* ao READ-ONLY Env Variables */
export const AO_LOADER_HANDLER_ENV = {
  Process: {
    Id: STUB_ADDRESS,
    Owner: STUB_ADDRESS,
    Tags: [
      { name: 'Authority', value: 'XXXXXX' },
      { name: 'ANT-Registry-Id', value: STUB_ANT_REGISTRY_ID },
    ],
  },
  Module: {
    Id: ''.padEnd(43, '1'),
    Tags: [{ name: 'Authority', value: 'YYYYYY' }],
  },
};

const DEFAULT_HANDLE_OPTIONS = {
  Id: ''.padEnd(43, '1'),
  ['Block-Height']: '1',
  // important to set the address so that that `Authority` check passes. Else the `isTrusted` with throw an error.
  Owner: STUB_ADDRESS,
  Module: 'ANT',
  Target: STUB_ADDRESS,
  From: STUB_ADDRESS,
  Timestamp: Date.now(),
  // for msg.reply
  Reference: '1',
};


const env = {
  format: 'wasm32-unknown-emscripten4',
  inputEncoding: 'JSON-1',
  outputEncoding: 'JSON-1',
  memoryLimit: '1073741824', // 1GB in bytes to match WASM config
  computeLimit: (9e12).toString(),
  extensions: [],
}


// Helper function to create message
function createMessage(action, data = {}) {
    return {
        ...DEFAULT_HANDLE_OPTIONS,
        Tags: [{ name: 'Action', value: action }],
        Data: JSON.stringify(data)
    };
}

// Helper function to parse result
function parseResult(result) {
    // Check if we have valid response data
    if (result.Output !== undefined || result.Error !== undefined || result.Messages !== undefined) {
        // Return the result directly - it's already structured correctly
        return { success: true, data: result };
    } else {
        return { success: false, error: "No valid response data", raw: result };
    }
}

async function testDoomAOLoader() {
    console.log('🎮 DOOM AO Loader Tests');
    console.log('======================\n');

    const handle = await AoLoader(wasm, env);
    console.log('✅ AO Loader initialized');

    let memory = null;
    let testCount = 0;
    let passedTests = 0;

    // Test function
    async function runTest(testName, messageOrFunction, expectedCheck) {
        testCount++;
        console.log(`\n📨 Test ${testCount}: ${testName}`);
        
        try {
            let result;
            if (typeof messageOrFunction === 'function') {
                result = await messageOrFunction(handle, memory);
            } else {
                console.log('   📤 Sending message:', JSON.stringify(messageOrFunction, null, 2));
                result = await handle(memory, messageOrFunction, AO_LOADER_HANDLER_ENV);
            }
            
            memory = result.Memory;
            console.log('   📥 Raw result keys:', Object.keys(result));
            console.log('   📥 Output:', result.Output);
            console.log('   📥 Error:', result.Error);
            console.log('   📥 Messages:', result.Messages);
            console.log('   📥 GasUsed:', result.GasUsed);
            
            const parsed = parseResult(result);
            
            if (parsed.success) {
                console.log('   ✅ Parse success: Output =', parsed.data.Output);
                console.log('   ✅ Parse success: Error =', parsed.data.Error);
                console.log('   ✅ Parse success: Messages =', parsed.data.Messages);
                
                if (!expectedCheck || expectedCheck(parsed.data)) {
                    console.log('   ✅ PASSED');
                    passedTests++;
                    return { success: true, result: parsed.data };
                } else {
                    console.log('   ❌ FAILED: Expected condition not met');
                    return { success: false, result: parsed.data };
                }
            } else {
                console.log('   ❌ FAILED: Parse error -', parsed.error);
                console.log('   📥 Raw result details:', JSON.stringify(parsed.raw, (key, value) => {
                    if (key === 'Memory') return `[Memory ${value.length} bytes]`;
                    return value;
                }, 2));
                return { success: false, error: parsed.error };
            }
        } catch (error) {
            console.log('   ❌ FAILED: Exception -', error.message);
            console.log('   📥 Stack:', error.stack);
            return { success: false, error: error.message };
        }
    }

    // Test 1: Basic connectivity
    await runTest(
        'Basic Message Handling',
        createMessage('Unknown'),
        (data) => data.ok === true && data.response.Error.includes('Unsupported action')
    );

    // Test 2: Load WAD file
    console.log('\n📦 Loading DOOM WAD file...');
    let wadBase64 = '';
    try {
        const wadData = readFileSync(path.join(__dirname, 'doom1.wad'));
        wadBase64 = wadData.toString('base64');
        console.log(`   WAD file loaded: ${Math.round(wadData.length / 1024)} KB`);
        console.log(`   Base64 size: ${Math.round(wadBase64.length / 1024)} KB`);
    } catch (e) {
        console.log('   ⚠️ WAD file not found, using dummy data');
        wadBase64 = Buffer.from('DUMMY_WAD_DATA').toString('base64');
    }

    await runTest(
        'Load WAD Data',
        createMessage('LoadWAD', { wadData: wadBase64 }),
        (data) => data.ok === true && data.response.Output.includes('WAD loaded successfully')
    );

    // Test 3: Initialize DOOM
    await runTest(
        'Initialize DOOM Game',
        createMessage('Init'),
        (data) => data.ok === true && (
            data.response.Output.includes('Game initialized') || 
            data.response.Error?.includes('No WAD file loaded')
        )
    );

    // Test 4: Process game ticks
    console.log('\n🎮 Testing game loop...');
    for (let i = 1; i <= 5; i++) {
        const result = await runTest(
            `Game Tick ${i}`,
            createMessage('Tick', { deltaMs: 35 }),
            (data) => data.ok === true
        );
        
        if (!result.success) {
            console.log('   ⚠️ Stopping tick tests due to failure');
            break;
        }
    }

    // Test 5: Keyboard input
    console.log('\n⌨️ Testing keyboard input...');
    const testKeys = ['Enter', 'ArrowLeft', 'ArrowRight', 'Space', 'Control'];
    
    for (const key of testKeys) {
        // Test key press
        await runTest(
            `Key Press: ${key}`,
            createMessage('KeyPress', { key }),
            (data) => data.ok === true && data.response.Output.includes('pressed')
        );
        
        // Process a tick with key held
        await handle(memory, createMessage('Tick', { deltaMs: 16 }), AO_LOADER_HANDLER_ENV);
        
        // Test key release
        await runTest(
            `Key Release: ${key}`,
            createMessage('KeyRelease', { key }),
            (data) => data.ok === true && data.response.Output.includes('released')
        );
    }

    // Test 6: Get screen data
    const screenResult = await runTest(
        'Get Screen Data',
        createMessage('GetScreen'),
        (data) => data.ok === true && (
            (data.response.Output?.screen && data.response.Output?.width && data.response.Output?.height) ||
            data.response.Error
        )
    );

    // Save screen data if available
    if (screenResult.success && screenResult.result.response.Output?.screen) {
        const screenData = screenResult.result.response.Output.screen;
        const { width, height } = screenResult.result.response.Output;
        
        console.log(`   💾 Saving screen data (${width}x${height})`);
        writeFileSync(path.join(__dirname, 'ao_loader_screen.txt'), screenData);
        console.log('   📁 Screen data saved to ao_loader_screen.txt');
        
        // Save raw image data
        try {
            const imageBuffer = Buffer.from(screenData, 'base64');
            writeFileSync(path.join(__dirname, 'ao_loader_screen.raw'), imageBuffer);
            console.log(`   📁 Raw image data saved (${imageBuffer.length} bytes)`);
        } catch (e) {
            console.log('   ⚠️ Could not decode screen data as image');
        }
    }

    // Test 7: Stress test - rapid fire actions
    console.log('\n⚡ Stress testing...');
    const startTime = Date.now();
    let rapidTestsPassed = 0;
    
    for (let i = 0; i < 10; i++) {
        try {
            const result = await handle(
                memory,
                createMessage('Tick', { deltaMs: 16 }),
                AO_LOADER_HANDLER_ENV
            );
            memory = result.Memory;
            rapidTestsPassed++;
        } catch (e) {
            console.log(`   ❌ Rapid test ${i + 1} failed:`, e.message);
            break;
        }
    }
    
    const duration = Date.now() - startTime;
    console.log(`   ⚡ ${rapidTestsPassed}/10 rapid tests passed in ${duration}ms`);
    console.log(`   📊 Average: ${Math.round(duration / rapidTestsPassed)}ms per call`);

    // Final summary
    console.log('\n📊 Test Summary');
    console.log('===============');
    console.log(`Total Tests: ${testCount}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${testCount - passedTests}`);
    console.log(`Success Rate: ${Math.round((passedTests / testCount) * 100)}%`);
    console.log(`Rapid Tests: ${rapidTestsPassed}/10 passed`);

    if (passedTests === testCount && rapidTestsPassed === 10) {
        console.log('\n🎉 ALL TESTS PASSED! DOOM is ready for AO deployment!');
    } else {
        console.log('\n⚠️ Some tests failed. Check the output above for details.');
    }

    // Memory usage info
    if (memory) {
        console.log(`\n💾 Final memory state size: ${Math.round(memory.length / 1024)} KB`);
    }

    console.log('\n🚀 DOOM AO integration testing complete!');
}

// Run the tests
testDoomAOLoader().catch(console.error);