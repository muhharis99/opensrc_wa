# ADR 0001: Clean-room and mock-first

## Status

Accepted.

## Decision

Implementasi dimulai dari contract, state machine, security controls, persistence, API, testkit, dan mock runtime. Koneksi live ditolak sampai detail protokol memiliki bukti clean-room yang sah.

## Consequences

Proyek dapat diuji dan diintegrasikan lebih awal tanpa klaim palsu. Kemajuan live lebih lambat, tetapi risiko lisensi, keamanan, dan credential lebih terkendali.
