# Regression baseline index

Current initial post-PR-#73 execution reference: **`f815b4946a7631a6860cf477e68af73894f7d403`**.

The [append-only baseline record](2026-11-25-post-73-f815b49.md#later-observation-on-2026-11-25-after-android-authorization) now includes successful full run **45703920858**, attempt 1, on the exact SHA. Its initial partial/skipped observations are preserved. Read the later observation for the completed execution status and the record's supported scope and unresolved claims.

An execution baseline is not a product-correctness or release approval. Add later dated observations rather than revising prior outcomes.

Checksum manifests preserve their observation versions too. The initial manifest's document hash binds the record at commit `588aacc`, before the appended entry; it is not a hash of the longer current file. Its other evidence files remain unchanged. The full-run directory has a separate manifest for the appended record and new evidence. Verify a historical record hash against the Git version that introduced its manifest, rather than rewriting an old manifest after an append.
