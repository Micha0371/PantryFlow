## Behavior and coverage

Describe the resulting behavior and link the relevant IDs in
`docs/testing/coverage-matrix.md`.

For behavior changes, update the acceptance scenarios and regression tests in
this pull request. Identify any manual or deferred coverage explicitly.

## Validation

Record the fast/database CI results and the Android run, which starts on its own when the
change reaches the app. If the head moved after a green Android run, record the result of
`node scripts/android-relevance.cjs --since <green> --head <head>` (docs/testing/README.md).
SDK or native dependency changes require the full harness, a fresh Android
build, and a physical-device smoke test. Include links and observed results.

Tests are independent (`docs/testing/test-independence.md`): no shared mutable state, no order, environment or timing dependence.
