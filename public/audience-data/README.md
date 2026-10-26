# Where the data went

The audience export left git on 2026-10-26, the night the bulk tiers landed and the set reached 132 MB. It serves from `s3://pax-trinity-audience-638175140432/exports/` behind the Amplify rewrite on this same `/audience-data/` path, so the app's fetches never changed. For local dev, sync the folder down:

    aws s3 sync s3://pax-trinity-audience-638175140432/exports/ public/audience-data/

The bucket's INVENTORY.md lists everything it holds — exports, the DuckDB store, and every source's raw files.
