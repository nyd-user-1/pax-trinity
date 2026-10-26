Every file in this directory is **synthetic**: the variable names and response codes are the sources' own (from the codebooks cited in `make_fixtures.py`), the respondents are invented.

- `ces/CES22_Common_SYNTHETIC.csv`: CES 2022 common content columns
- `wvs/WVS7_USA_SYNTHETIC.csv`: WVS wave 7 columns, 45 US rows and 5 GB rows
- `ma_voterfile/ma_voterfile_20261001_SYNTHETIC.csv`: party codes D/R/U/L and a City/Town column
- `gss/gss_SYNTHETIC.csv`, `anes/anes_cdf_SYNTHETIC.csv`, `cps/cps_ipums_SYNTHETIC.csv`: recode and rate fixtures for the real-data loaders

File names carry `SYNTHETIC`; every loader refuses such a file unless a test passes `allow_synthetic=True`, so a fixture copied into `raw/` never reaches the real store.

Regenerate with `python tests/fixtures/make_fixtures.py` (fixed seed).
