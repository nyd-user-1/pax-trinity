-- CPS moves from IPUMS to the Census public-use files; the poll and ballot-result sources and
-- their four constructs; the geographies lookup.

UPDATE sources SET
  name = 'Current Population Survey, November Voting and Registration Supplement (U.S. Census Bureau)',
  url = 'https://www.census.gov/data/datasets/time-series/demo/cps/cps-supp_cps-repwgt/cps-voting.html',
  license = 'Public domain (U.S. federal government work, 17 U.S.C. 105)',
  access_notes = 'Public-use files at www2.census.gov/programs-surveys/cps/datasets/<year>/supp/, no registration: nov<yy>pub.csv for 2020-2024, fixed-width nov<yy>pub.dat.gz for 2016 and 2018. Downloaded once into raw/cps/.'
WHERE source = 'CPS';

INSERT INTO sources (source, name, url, license, access_notes) VALUES
  ('POLL',
   'Published public-opinion polls: toplines from pollsters'' releases, and the AP-NORC May 2016 public-use file',
   'https://apnorc.org/wp-content/uploads/2020/02/AP-NORC-Campaign-and-Election-May-2016-PUF.zip',
   'Toplines are quoted from each publisher''s release, and rights stay with the publisher. The AP-NORC public-use file is posted for public use; its codebook states no license.',
   'Toplines from audience/seed/open_primary_polls.csv, each row carrying its publisher''s URL in provenance_url. The AP-NORC zip is downloaded once into raw/apnorc/.'),
  ('ELECTION_RESULT',
   'Official ballot-measure results (state election offices)',
   'https://www.usa.gov/state-election-office',
   'Public records of state election offices.',
   'From audience/seed/open_primary_polls.csv; each row carries its election office''s results page in provenance_url.')
ON CONFLICT (source) DO NOTHING;

INSERT INTO concordance (construct, label, definition, notes) VALUES
  ('open_primaries_support', 'Support for open primaries',
   'Support for primaries open to all voters, as asked in a poll or decided by a ballot measure; item_text gives each wording.',
   'Ballot-measure rows: Yes is a vote for the measure as titled in item_text, which for a repeal measure is a vote against the open system.'),
  ('closed_primaries_favorability', 'Favorability of closed primaries',
   'Favorable or unfavorable view of primaries closed to all but registered party members.', NULL),
  ('top_two_favorability', 'Favorability of top-two primaries',
   'Favorable or unfavorable view of a top-two primary, where all candidates share one ballot and the two leading vote-getters advance.', NULL),
  ('top_four_favorability', 'Favorability of top-four primaries',
   'Favor or oppose a top-four primary, where all candidates share one ballot and the four leading vote-getters advance, as in Alaska.', NULL)
ON CONFLICT (construct) DO NOTHING;

CREATE TABLE IF NOT EXISTS geographies (
  geo_code    text PRIMARY KEY,
  name        text NOT NULL,
  level       text NOT NULL,   -- US | STATE | COUNTY | TOWN | BLOCKGROUP, as norms.geography
  parent_code text             -- the containing geography's geo_code; NULL for the US
);
