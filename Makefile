MOCHA_OPTS = --bail --check-leaks

coverage:
	@node_modules/.bin/istanbul cover \
		node_modules/.bin/_mocha -- \
		$(MOCHA_OPTS)

test:
	@node_modules/.bin/mocha $(MOCHA_OPTS)

test-travis:
	@node_modules/.bin/istanbul cover \
		node_modules/.bin/_mocha \
		--report lcovonly -- \
		$(MOCHA_OPTS)

bench:
	@node_modules/.bin/matcha --expose-gc

.PHONY: coverage test test-travis
