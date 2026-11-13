.PHONY: setup fmt check test test-native build golden parity demo all

setup:
	@fe --version | grep -q "26.6.0" || (echo "Error: Fe 26.6.0 required" && exit 1)
	@echo "Fe 26.6.0 verified"

fmt:
	fe fmt ingots
	fe fmt test

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

serve:
	npm --prefix demo run serve

test-session:
	npm --prefix demo run test:session

example-c:
	gcc -Iexamples/c examples/c/main.c -o examples/c/test_c && ./examples/c/test_c

example-rust:
	cd examples/rust && cargo check

all: check test build parity demo test-session
