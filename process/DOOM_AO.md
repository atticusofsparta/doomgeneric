
# Project outline

The purpose of this project is compile DOOM for running on AO (Actor Oriented) Network.

AO runs WASM binaries using ao-loader (@permaweb/aoloader is the package that instantiates wasm modules
and persisted wasm memory to evaluate the 'processes' which are like smart contracts)

This export a `handle` function that consumes a msgJSON and envJSON arguments (strings) that
are then used to process actions and alter the state of the process.

To enable doom to be compatible when need to wrap the program in this exported handle function, that
can consume input as json, process it, then spit out the resulting program changes.

For example, keypresses would be passed in as json and translated for program to affect state.

## Implementation Status: ✅ COMPLETED

The DOOM AO integration has been successfully implemented with the following components:

### Core Files Created:
- `doomgeneric/doomgeneric_ao.c` - AO platform implementation for doomgeneric
- `ao_c/with-emsdk-container/src/doom_ao_process.c` - Main AO process with handle function
- Updated `ao_c/with-emsdk-container/Makefile` - Builds DOOM with AO dependencies

### Features Implemented:
- ✅ JSON message-based input system (KeyPress/KeyRelease actions)
- ✅ Game state management through Tick actions
- ✅ Screen buffer export as base64-encoded data
- ✅ Game initialization via Init action
- ✅ Full DOOM game engine integration
- ✅ Emscripten/WASM compilation support

### Message API:
- `Init` - Initialize the game
- `Tick` - Process a game frame
- `KeyPress`/`KeyRelease` - Send keyboard input
- `GetScreen` - Retrieve current screen buffer

See `DOOM_AO_USAGE.md` for complete usage documentation and `test_doom_ao.js` for example messages.

