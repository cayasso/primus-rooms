REPORTER = spec
MOCHA_OPTS= --check-leaks

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--bail \
		$(MOCHA_OPTS)

bench:
	@./node_modules/.bin/matcha \
	--expose-gc

.PHONY: test
