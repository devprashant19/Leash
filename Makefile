.PHONY: setup fmt check test test-native build golden parity demo all

setup:
	@fe --version | grep -q "26.6.0" || (echo "Error: Fe 26.6.0 required" && exit 1)
	@echo "Fe 26.6.0 verified"

fmt:
	fe fmt ingots test

check:
	fe fmt --check ingots
	fe fmt --check test
	fe check

test:
	fe test

test-native:
	fe test --backend native

build:
	fe build
	fe build ingots/module --emit sizes

golden:
	bash scripts/golden.sh

parity:
	fe test -i parity_tests

demo:
	cd demo && npm install && npm run demo

all: check test build parity demo
