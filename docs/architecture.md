# Architecture

GENX is a local-first POS: the desktop app writes to a local database, queues changes in an outbox, and syncs to the cloud API when online.

See the design spec in the project README and `docs/offline-first.md`, `docs/sync.md`.
