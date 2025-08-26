#!/usr/bin/env node

// Simple test script to demonstrate DOOM AO integration
// This would typically be run in an AO environment

const testMessages = [
  {
    name: "Initialize Game",
    message: {
      Tags: [{ name: "Action", value: "Init" }]
    }
  },
  {
    name: "Process First Tick",
    message: {
      Tags: [{ name: "Action", value: "Tick" }],
      Data: { deltaMs: 16 }
    }
  },
  {
    name: "Press Left Arrow",
    message: {
      Tags: [{ name: "Action", value: "KeyPress" }],
      Data: { key: "ArrowLeft" }
    }
  },
  {
    name: "Process Tick with Movement",
    message: {
      Tags: [{ name: "Action", value: "Tick" }],
      Data: { deltaMs: 16 }
    }
  },
  {
    name: "Release Left Arrow",
    message: {
      Tags: [{ name: "Action", value: "KeyRelease" }],
      Data: { key: "ArrowLeft" }
    }
  },
  {
    name: "Get Screen Buffer",
    message: {
      Tags: [{ name: "Action", value: "GetScreen" }]
    }
  },
  {
    name: "Press Fire (Control)",
    message: {
      Tags: [{ name: "Action", value: "KeyPress" }],
      Data: { key: "Control" }
    }
  },
  {
    name: "Process Tick with Fire",
    message: {
      Tags: [{ name: "Action", value: "Tick" }],
      Data: { deltaMs: 16 }
    }
  },
  {
    name: "Release Fire",
    message: {
      Tags: [{ name: "Action", value: "KeyRelease" }],
      Data: { key: "Control" }
    }
  }
];

console.log("DOOM AO Integration Test Messages");
console.log("=================================\n");

testMessages.forEach((test, index) => {
  console.log(`${index + 1}. ${test.name}:`);
  console.log("Message:", JSON.stringify(test.message, null, 2));
  console.log("Expected: JSON response with game state updates\n");
});

console.log("Usage:");
console.log("1. Build the WASM module: cd ao_c/with-emsdk-container && make wasm");
console.log("2. Deploy as AO module");
console.log("3. Send these messages to test functionality");
console.log("4. Implement a game loop by sending Tick messages at regular intervals");
console.log("5. Send KeyPress/KeyRelease messages based on user input");
console.log("6. Periodically call GetScreen to display the game state\n");

console.log("Controls:");
console.log("- Arrow keys: Movement");
console.log("- Space: Use/Open doors");
console.log("- Control: Fire weapon");
console.log("- Shift: Run");
console.log("- Escape: Menu");
console.log("- Enter: Select/Continue");
