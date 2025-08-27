JANSSON_VERSION = 2.13

JANSSON_HEADERS = $(addprefix includes/, jansson.h jansson_config.h)
JANSSON_LIBRARY = libs/libjansson.a
JANSSON_TARBALL = downloads/jansson-${JANSSON_VERSION}.tar.gz

# DOOM source files (relative to doomgeneric directory)
DOOM_SRC_DIR = ../../doomgeneric
DOOM_SOURCES = dummy.c am_map.c doomdef.c doomstat.c dstrings.c d_event.c d_items.c \
	d_iwad.c d_loop.c d_main.c d_mode.c d_net.c f_finale.c f_wipe.c g_game.c \
	hu_lib.c hu_stuff.c info.c i_cdmus.c i_endoom.c i_joystick.c i_scale.c \
	i_sound.c i_system.c i_timer.c memio.c m_argv.c m_bbox.c m_cheat.c \
	m_config.c m_controls.c m_fixed.c m_menu.c m_misc.c m_random.c p_ceilng.c \
	p_doors.c p_enemy.c p_floor.c p_inter.c p_lights.c p_map.c p_maputl.c \
	p_mobj.c p_plats.c p_pspr.c p_saveg.c p_setup.c p_sight.c p_spec.c \
	p_switch.c p_telept.c p_tick.c p_user.c r_bsp.c r_data.c r_draw.c \
	r_main.c r_plane.c r_segs.c r_sky.c r_things.c sha1.c sounds.c \
	statdump.c st_lib.c st_stuff.c s_sound.c tables.c v_video.c wi_stuff.c \
	w_checksum.c w_file.c w_main.c w_wad.c z_zone.c w_file_stdc.c w_file_memory.c \
	i_input.c i_video.c doomgeneric.c doomgeneric_ao.c

.PHONY: wasm test clean realclean

wasm: src/doom_process.wasm
src/doom_process.wasm: src/doom_ao_process.c ${JANSSON_HEADERS} ${JANSSON_LIBRARY} $(addprefix ${DOOM_SRC_DIR}/, ${DOOM_SOURCES})
	docker container run \
		--rm \
		--volume "$$(pwd)/src":/src \
		--volume "$$(pwd)/includes":/includes \
		--volume "$$(pwd)/libs":/libs \
		--volume "$$(pwd)/${DOOM_SRC_DIR}":/doom \
		emscripten/emsdk:4.0.6 \
		emcc \
			-O3 \
			-g2 \
			-s ASYNCIFY=1 \
			-s STACK_SIZE=8388608 \
			-s ASYNCIFY_STACK_SIZE=50000 \
			-s ALLOW_MEMORY_GROWTH=1 \
			-s INITIAL_MEMORY=536870912 \
			-s MAXIMUM_MEMORY=1073741824 \
			-s WASM=1 \
			-s MODULARIZE \
			-s DETERMINISTIC=1 \
			-s NODERAWFS=0 \
			-s FORCE_FILESYSTEM=1 \
			-msimd128 \
			-s ASSERTIONS=1 \
			-I /includes \
			-I /doom \
			-DNORMALUNIX \
			-DLINUX \
			-D_DEFAULT_SOURCE \
			doom_ao_process.c \
			$(addprefix /doom/, ${DOOM_SOURCES}) \
					/${JANSSON_LIBRARY} \
		-s EXPORTED_FUNCTIONS='["_malloc","_main","_handle"]' \
		-s EXPORTED_RUNTIME_METHODS='["cwrap"]' \
		-o doom_process.mjs

test: wasm
	@$(MAKE) -C ../.. test-deps
	../../test.mjs src/doom_process.wasm wasm32-unknown-emscripten4 all

clean:
	rm -f src/doom_process.mjs src/doom_process.wasm

realclean: clean
	rm -fr build includes libs


###########################################################
# Custom targets for this repo

.PHONY: headers
headers: ${JANSSON_HEADERS}

.PHONY: libs
libs: ${JANSSON_LIBRARY}


#######################################################################################################################
# Jansson library dependency for JSON serialization/deserialization

${JANSSON_HEADERS}: build/jansson-${JANSSON_VERSION}/Makefile
	@mkdir -p includes
	cp build/jansson-${JANSSON_VERSION}/src/$(@F) $@
${JANSSON_LIBRARY}: build/jansson-${JANSSON_VERSION}/src/.libs/libjansson.a
	mkdir -p libs
	cp build/jansson-${JANSSON_VERSION}/src/.libs/libjansson.a ${JANSSON_LIBRARY}
build/jansson-${JANSSON_VERSION}/src/.libs/libjansson.a: build/jansson-${JANSSON_VERSION}/Makefile
	cd build/jansson-${JANSSON_VERSION} && docker container run \
		--rm \
		--volume "$$(pwd)":/src \
		emscripten/emsdk:4.0.6 \
		make
build/jansson-${JANSSON_VERSION}/Makefile: build/jansson-${JANSSON_VERSION}/configure
	cd build/jansson-${JANSSON_VERSION} && docker container run \
		--rm \
		--volume "$$(pwd)":/src \
		emscripten/emsdk:4.0.6 \
		emconfigure \
			./configure
build/jansson-${JANSSON_VERSION}/src build/jansson-${JANSSON_VERSION}/configure: | ${JANSSON_TARBALL}
	mkdir -p build
	tar -zxf ${JANSSON_TARBALL} -C build
${JANSSON_TARBALL}:
	mkdir -p downloads
	wget https://digip.org/jansson/releases/jansson-${JANSSON_VERSION}.tar.gz -O ${JANSSON_TARBALL}