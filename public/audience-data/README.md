# Where the data went

The audience export left git on 2026-10-26, the night the bulk tiers landed and the set reached 132 MB. It serves from `s3://pax-trinity-audience-613473203863/exports/` (profile pax-new, us-east-2) behind the Amplify rewrite on this same `/audience-data/` path, so the app's fetches never changed. For local dev, pull the folder down:

    node scripts/exports/sync.mjs pull public/audience-data

Every read and write of `exports/` goes through `scripts/exports/sync.mjs`, not `aws s3 sync` or `aws s3 cp`. The objects carry Cache-Control, and index.json and the q/ files can be stored brotli: the AWS CLI would save those bytes still compressed, and would upload without the headers.

The bucket's INVENTORY.md lists everything it holds — exports, the DuckDB store, and every source's raw files.
