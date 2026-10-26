-- Sources for the lift loaders: the published archive of campaigns' own persuasion
-- experiments (LIFT_ARCHIVE) and PAX's own test waves (PAX_TEST).

INSERT INTO sources (source, name, url, license, access_notes) VALUES
  ('LIFT_ARCHIVE',
   'Archive of campaigns'' own persuasion experiments (Hewitt, Broockman, Coppock et al., APSR 2024), replication archive',
   'https://doi.org/10.7910/DVN/LBPSSV',
   'CC0 1.0 (Harvard Dataverse).',
   'No login. replication_archive.zip is downloaded once into raw/lift_archive/ and unzipped there.'),
  ('PAX_TEST',
   'PAX message-test waves',
   'https://github.com/nyd-user-1/pax-trinity/blob/main/audience/seed/pax_waves.csv',
   'Internal: PAX''s own experiments.',
   'Supplied by the lead as seed/pax_waves.csv; the loader exits 0 with a note when it is absent.')
ON CONFLICT (source) DO NOTHING;
