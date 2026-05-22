SRC   ?= /src/apcalc
OUT   ?= /out
BUILD := /tmp/apcalc-build

EMCC_LDFLAGS := -sNO_EXIT_RUNTIME=1 -sFORCE_FILESYSTEM=1 -Os

COMMON_VARS := \
	CHECK_TARGETS= \
	LATE_TARGETS= \
	BLD_TYPE=calc-static-only \
	EXT=.js \
	USE_READLINE= \
	READLINE_LIB= \
	READLINE_EXTRAS= \
	READLINE_INCLUDE=

.PHONY: all clean

all: $(OUT)/apcalc-core.js

$(OUT)/apcalc-core.js:
	cp -r $(SRC)/. $(BUILD)
	# Stage 1: generate headers with native gcc; disable arc4random (not in Emscripten sysroot)
	make -C $(BUILD) $(COMMON_VARS) HAVE_ARC4RANDOM=-DHAVE_NO_ARC4RANDOM .hsrc errsym.h
	# Stage 2: compile + link with emcc (LCC=emcc, headers already exist)
	# Target calc-static.js directly to skip the post-build symlink step (which fails with EXT=.js)
	emmake make -C $(BUILD) $(COMMON_VARS) LCC=emcc LDFLAGS="$(EMCC_LDFLAGS)" calc-static.js
	cp $(BUILD)/calc-static.js   $(OUT)/apcalc-core.js
	cp $(BUILD)/calc-static.wasm $(OUT)/apcalc-core.wasm

clean:
	rm -rf $(BUILD)
