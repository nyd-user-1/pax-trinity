-- Sources for the survey and voter-file loaders (CPS, VOTERFILE_MA, GSS, ANES, CES, WVS).
-- Their attitude constructs' concordance rows are written by the loaders themselves
-- (audience/survey.py merge_concordance), each adding its own variable names.

INSERT INTO sources (source, name, url, license, access_notes) VALUES
  ('CPS',
   'Current Population Survey, November Voting and Registration Supplement (U.S. Census Bureau), via IPUMS CPS',
   'https://cps.ipums.org/cps/',
   'Census microdata are public domain (17 U.S.C. 105); IPUMS CPS extracts are used under the IPUMS terms: cite IPUMS CPS, do not redistribute the microdata.',
   'IPUMS CPS API with a free account key in IPUMS_API_KEY. The extract is cached under raw/ipums/<definition hash>/.'),
  ('VOTERFILE_MA',
   'Massachusetts statewide voter list (Secretary of the Commonwealth, Elections Division)',
   'https://www.sec.state.ma.us/divisions/elections/',
   'Not a public record: MGL c.51 s.47C limits the list to eligible requesters and uses. Only aggregate counts are stored.',
   'Requested in writing from the Elections Division. CSV files go under raw/ma_voterfile/.'),
  ('GSS',
   'General Social Survey cumulative cross-section 1972-2024 (NORC at the University of Chicago)',
   'https://gss.norc.org/',
   'Free public use with citation of the GSS (NORC).',
   'No registration. The cumulative Stata file is downloaded once into raw/gss/.'),
  ('ANES',
   'ANES Time Series Cumulative Data File 1948-2024 (American National Election Studies)',
   'https://electionstudies.org/data-center/anes-time-series-cumulative-data-file/',
   'Free for research use under the ANES terms of use, with citation.',
   'No login; the site needs a browser-like client (curl_cffi). The Stata zip is downloaded once into raw/anes/.'),
  ('CES',
   'Cooperative Election Study common content 2020, 2022, 2024 (Harvard University)',
   'https://cces.gov.harvard.edu/',
   'CC0 1.0 (Harvard Dataverse).',
   'No login. Common-content files (CSV or Stata) go under raw/ces/; the loader prints the Dataverse links when none is there.'),
  ('WVS',
   'World Values Survey wave 7 (2017-2022), United States (WVS Association)',
   'https://www.worldvaluessurvey.org/',
   'Free for non-commercial use under the WVSA conditions of use, with citation.',
   'Download needs the WVSA registration form. The US or cross-national wave-7 file goes under raw/wvs/.')
ON CONFLICT (source) DO NOTHING;
