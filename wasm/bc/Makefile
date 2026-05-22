SRC   ?= /src/bc
OUT   ?= /out
BUILD := /tmp/bc-build

EMCC_LDFLAGS := -sNO_EXIT_RUNTIME=1 -sFORCE_FILESYSTEM=1 -Os

.PHONY: all clean

all: $(OUT)/bc-core.js

$(OUT)/bc-core.js:
	mkdir -p $(BUILD) $(OUT)
	cd $(BUILD) && emconfigure $(SRC)/configure --without-readline --without-libedit
	# lib を先にビルドしてから bc だけビルド（doc は makeinfo 不要のためスキップ）
	emmake make -C $(BUILD)/lib
	emmake make -C $(BUILD)/bc EXEEXT=.js LDFLAGS="$(EMCC_LDFLAGS)"
	cp $(BUILD)/bc/bc.js   $(OUT)/bc-core.js
	cp $(BUILD)/bc/bc.wasm $(OUT)/bc-core.wasm

clean:
	rm -rf $(BUILD)
