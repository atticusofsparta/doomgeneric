#!/usr/bin/env tsx

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔧 Simple TypeScript AO Loader Test');
console.log('===================================\n');

async function testAOLoader() {
  try {
    console.log('Step 1: Loading WASM binary...');
    const wasmPath = path.join(__dirname, 'src/doom_process.wasm');
    const wasmBinary = readFileSync(wasmPath);
    console.log(`✅ WASM loaded: ${Math.round(wasmBinary.length / 1024)} KB`);

    console.log('\nStep 2: Importing AO Loader...');
    // Try dynamic import to see if it works better with TypeScript
    const { default: AoLoader } = await import('@permaweb/ao-loader');
    console.log('✅ AO Loader imported successfully');
    console.log('AO Loader type:', typeof AoLoader);

    console.log('\nStep 3: Creating AO Loader handle...');
    const config = {
      format: "wasm32-unknown-emscripten4",
      inputEncoding: "JSON-1",
      outputEncoding: "JSON-1",
      memoryLimit: "1073741824", // 1GB
      computeLimit: "9000000000",
      extensions: []
    };

    const handle = await AoLoader(wasmBinary, config);
    console.log('✅ AO Loader handle created successfully');
    console.log('Handle type:', typeof handle);

    console.log('\nStep 4: Testing basic message...');
    const message = {
      Id: "test-msg-001",
      "Block-Height": "1",
      Owner: "test-owner-1234567890123456789012345",
      Module: "DOOM",
      Target: "test-target-1234567890123456789012345",
      From: "test-from-1234567890123456789012345",
      Timestamp: Date.now(),
      Reference: "1",
      Tags: [{ name: "Action", value: "Tick" }],
      Data: JSON.stringify({ deltaMs: 16 })
    };

    const environment = {
      Process: {
        Id: "test-process",
        Owner: "test-owner",
        Tags: [
          { name: "Data-Protocol", value: "ao" },
          { name: "Type", value: "Process" }
        ]
      }
    };

    const result = await handle(null, message, environment);
    console.log('✅ Message processed successfully');
    console.log('Result keys:', Object.keys(result));
    console.log('Output:', result.Output);
    console.log('Error:', result.Error);

    console.log('\n🎉 All tests passed! TypeScript + AO Loader is working.');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testAOLoader();
