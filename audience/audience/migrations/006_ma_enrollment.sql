-- The Secretary of the Commonwealth's published party-enrollment counts replace the MA voter
-- file, which is retired: its source and its unused construct go.

DELETE FROM norms WHERE source = 'VOTERFILE_MA';
DELETE FROM sources WHERE source = 'VOTERFILE_MA';
DELETE FROM concordance WHERE construct = 'party_registration'
  AND NOT EXISTS (SELECT 1 FROM norms WHERE construct = 'party_registration');

INSERT INTO sources (source, name, url, license, access_notes) VALUES
  ('MA_ENROLLMENT',
   'Massachusetts registered voters and party enrollment by city and town (Secretary of the Commonwealth, Elections Division)',
   'https://www.sec.state.ma.us/divisions/elections/research-and-statistics/registration-statistics.htm',
   'Public records of the Secretary of the Commonwealth.',
   'PDFs from the Registration Statistics page, no registration. The site refuses plain HTTP clients, so the loader downloads through curl_cffi into raw/ma_enrollment/.')
ON CONFLICT (source) DO NOTHING;

INSERT INTO concordance (construct, label, definition, notes) VALUES
  ('registration_by_party', 'Registration by party',
   'Registered voters by party enrollment, unenrolled status, or political designation, as the Secretary of the Commonwealth counts them.',
   'Town tables print the parties and Unenrolled but not Political Designations; that option is the town''s registered voters less the printed columns, and its county and statewide sums equal the published Political Designations column.')
ON CONFLICT (construct) DO NOTHING;
