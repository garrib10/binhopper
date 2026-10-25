# Offline Discogs CC0 extract

30 real vinyl releases, their 30 masters and 21 credited artists, manually stream-extracted
from the official **2026-10-01** Discogs monthly dumps on 2026-10-25. This was a one-time
fixture preparation operation outside tests and CI; no test downloads data or contacts Discogs.

Source files (use the official download endpoint, not anonymous S3 listing):

- https://data.discogs.com/?download=data/2026/discogs_20261001_releases.xml.gz
- https://data.discogs.com/?download=data/2026/discogs_20261001_masters.xml.gz
- https://data.discogs.com/?download=data/2026/discogs_20261001_artists.xml.gz

Selected the first 30 vinyl releases with a master, then only those exact masters and credited
artists. Retained catalog fields used by the importer; omitted contributor/account metadata,
image metadata and unrelated fields. Email addresses in artist profiles are replaced with
`[contact omitted]`. No artwork files are included. Tests may copy these files to a temporary
gzip file to exercise the streaming parser; the source fixture remains offline XML for review.

Discogs releases its monthly dumps under CC0 1.0:
https://data.discogs.com/ and https://creativecommons.org/publicdomain/zero/1.0/.
These files are catalog data, not source code licensed by a third-party test-fixture repository.
