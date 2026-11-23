"""Run the Jira tooling tests in a random, reproducible order.

Seed: env PF_TEST_SEED (integer) or a random one. Reproduce a run with
PF_TEST_SEED=<seed> python tools/jira/run_tests.py
"""
import os
import random
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)


def flatten(suite):
    for item in suite:
        if isinstance(item, unittest.TestSuite):
            yield from flatten(item)
        else:
            yield item


def main():
    raw = os.environ.get("PF_TEST_SEED")
    seed = int(raw) if raw else random.SystemRandom().randrange(2**32)
    print(f"Randomized test order seed: {seed}", flush=True)
    tests = list(flatten(unittest.defaultTestLoader.discover(HERE, pattern="test_*.py", top_level_dir=HERE)))
    random.Random(seed).shuffle(tests)
    result = unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(tests))
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main())
