-- Sources and concordance rows for the population constructs.
-- Attitude constructs arrive in later migrations.

INSERT INTO sources (source, name, url, license, access_notes) VALUES
  ('ACS',
   'American Community Survey 5-year estimates (U.S. Census Bureau)',
   'https://www.census.gov/programs-surveys/acs',
   'Public domain (U.S. federal government work, 17 U.S.C. 105)',
   'Census Data API at api.census.gov; free key in CENSUS_API_KEY. Responses cached under raw/acs/.'),
  ('CVAP',
   'Citizen Voting Age Population by Race and Ethnicity, special tabulation from the ACS 5-year estimates (U.S. Census Bureau)',
   'https://www.census.gov/programs-surveys/decennial-census/about/voting-rights/cvap.html',
   'Public domain (U.S. federal government work, 17 U.S.C. 105)',
   'Read from the govblock lake parquet at s3://govblock-lake-638175140432/lake/v1/elections/cvap_*/, cached under raw/cvap/. Original release: https://www2.census.gov/programs-surveys/decennial/rdo/datasets/2024/2024-cvap/CVAP_2020-2024_ACS_csv_files.zip')
ON CONFLICT (source) DO NOTHING;

INSERT INTO concordance (construct, label, definition, acs_table, notes) VALUES
  ('sex', 'Sex',
   'Sex as reported: Male or Female.',
   'B01001',
   'ACS rows: universe population 18 and over.'),
  ('age_bucket', 'Age group',
   'Age in four adult bands: 18-29, 30-44, 45-64, 65+.',
   'B01001',
   'ACS rows: universe population 18 and over; also split by sex.'),
  ('race_eth', 'Race and ethnicity',
   'Five exclusive groups: Hispanic or Latino (any race); then, among non-Hispanic people, White alone; Black alone; Asian or Pacific Islander (Asian alone, or Native Hawaiian and Other Pacific Islander alone); Other or multiracial (American Indian and Alaska Native alone, some other race alone, two or more races).',
   'B03002',
   'ACS rows: universe total population. CVAP rows: universe citizens 18 and over; CVAP has no some-other-race-alone line, so its Other or multiracial group is American Indian and Alaska Native alone plus the four two-race lines plus the remainder line.'),
  ('education_4', 'Education',
   'Highest level completed, four groups: HS or less (no schooling through a high school diploma or GED); Some college (some college without a degree, or an associate''s degree); BA (bachelor''s degree); Grad (master''s, professional or doctorate degree).',
   'B15003',
   'ACS rows: universe population 25 and over.'),
  ('hh_income_bucket', 'Household income',
   'Household income in the past 12 months, six bands: Under $25,000; $25,000-$49,999; $50,000-$74,999; $75,000-$99,999; $100,000-$149,999; $150,000 or more.',
   'B19001',
   'ACS rows: universe households; dollars inflation-adjusted to the last year of the 5-year period.'),
  ('citizenship', 'Citizenship',
   'Citizen by birth (born in the U.S., Puerto Rico or the U.S. Island Areas, or abroad to an American parent); Naturalized citizen; Not a citizen.',
   'B05001',
   'ACS rows: universe total population.'),
  ('cvap', 'Citizen voting-age population',
   'U.S. citizens aged 18 and over. pct rows give the share of the 18+ population, overall or within a group, who are citizens.',
   'B29001',
   'Loaded from the CVAP special tabulation by race and ethnicity; ACS B29001 publishes the same total.'),
  ('registration', 'Voter registration',
   'Registered to vote for the given election.',
   NULL, NULL),
  ('turnout', 'Turnout',
   'Voted in the given election.',
   NULL, NULL)
ON CONFLICT (construct) DO NOTHING;
