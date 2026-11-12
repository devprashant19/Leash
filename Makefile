.PHONY: setup fmt check test test-native build golden parity demo all

setup:
	@fe --version | grep -q "26.6.0" || (echo "Error: Fe 26.6.0 required" && exit 1)
	@echo "Fe 26.6.0 verified"

fmt:
	fe fmt ingots

check:
	fe fmt --check ingots
	fe check

test:
	fe test

test-native:
	fe test --backend native

build:
	fe build
	fe build --emit sizes

golden:
	@echo "Golden tests: no-op until Phase 3"

parity:
	@echo "Parity tests: no-op until Phase 5"

demo:
	@echo "Demo: no-op until Phase 6"

all: check test test-native build golden
