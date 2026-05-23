SRC   ?= /src/bc
OUT   ?= /out
BUILD := /tmp/bc-build

EMCC_LDFLAGS := -sNO_EXIT_RUNTIME=1 -sFORCE_FILESYSTEM=1 -Os

.PHONY: all clean

all: $(OUT)/bc-core.js $(OUT)/dc-core.js

# bc and dc share the same configure + lib build, so one recipe produces both.
$(OUT)/bc-core.js $(OUT)/dc-core.js:
	mkdir -p $(BUILD) $(OUT)
	cd $(BUILD) && emconfigure $(SRC)/configure --without-readline --without-libedit
	emmake make -C $(BUILD)/lib
	emmake make -C $(BUILD)/bc EXEEXT=.js LDFLAGS="$(EMCC_LDFLAGS)"
	emmake make -C $(BUILD)/dc EXEEXT=.js LDFLAGS="$(EMCC_LDFLAGS)"
	cp $(BUILD)/bc/bc.js   $(OUT)/bc-core.js
	cp $(BUILD)/bc/bc.wasm $(OUT)/bc-core.wasm
	cp $(BUILD)/dc/dc.js   $(OUT)/dc-core.js
	cp $(BUILD)/dc/dc.wasm $(OUT)/dc-core.wasm

clean:
	rm -rf $(BUILD)
