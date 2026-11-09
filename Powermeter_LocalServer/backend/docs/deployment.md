# Deployment review checklist (examples only)

No service, database, broker, firewall, cron job or remote host was modified. Files under `deploy/` are reviewable examples, not an automatic deployment. This guide targets Raspberry Pi OS 64-bit / Pi 4 with Node.js 22+ (confirm compatibility with installed dependencies), PostgreSQL, Mosquitto and Nginx. Use an SSD for sustained ingestion and monitor free space/WAL growth; five devices at 1 Hz produce about 13 million rows in 30 days.

## Before enabling anything

1. Reserve the host's LAN address. Do not add router port forwarding. Keep PostgreSQL loopback/Unix-socket only and backend bound to loopback (`HOST=127.0.0.1` if supported by runtime configuration). Confirm actual listener with OS tools; do not assume a variable unsupported by the app restricts it. Firewall the Express port from LAN so Nginx authentication cannot be bypassed. Allow broker only from approved LAN/device segment. Example Mosquitto bind address `192.168.1.15` must be replaced with the target Pi's address, not blindly copied.
2. Install dependencies from the backend lockfile and execute application plus script tests. Use an unprivileged `powermeter` Linux user. Copy code to `/opt/powermeter/backend` and React build to `/opt/powermeter/frontend/dist`. Keep code read-only to the service account. Do not run development watchers in production.
3. Provision a fresh database and migration-owner role. Review SQL and explicit enhancement approval; run both migrations manually as described in `schema-and-operations.md`. Provision a separate non-owner runtime role with CONNECT, schema USAGE, SELECT/INSERT/UPDATE on application tables and sequence USAGE/SELECT (DELETE only if deliberately needed). Runtime must not be superuser, own schema, migrate, or have access to unrelated databases. Use a separate retention operator if runtime DELETE is unnecessary.
4. Provision `/etc/powermeter/backend.env` outside Git with database/MQTT credentials and runtime environment names from the backend configuration. Restrict ownership/permissions (root-controlled, service-readable only). Do not create secrets from examples in source. Set production, allowed dashboard origins, actual bind address, database, MQTT username/password and offline/relay timeouts. Systemd reads this environment file; no tracked `.env` is supplied here. Simulator credentials should use a device user, never the backend account.
5. Create Mosquitto password entries interactively using `mosquitto_passwd` for `powermeter-backend` and each device code; use `-c` only once when creating a new password file, never on an existing credential file. Install reviewed ACL/password paths with broker-readable restricted permissions. ACL gives devices write access only to their measurement/heartbeat/availability/state and read access only to their own command. Backend has the inverse minimum permissions. Unauthorized topic tests must fail, anonymous access must fail. Test with a separate development broker first.
6. Configure TLS for the broker and Nginx before using credentials over an untrusted LAN/Wi-Fi. The port-80/1883 examples alone are **not production-secure**: passwords/basic auth are observable without TLS. Use a trusted local CA or correctly provisioned certificates and hostname verification; never disable verification. Register the matching CORS and WebSocket origin allowlists in the backend. LAN-only does not replace authentication.
7. Review `deploy/nginx.conf`, adjust static root, server name and allowed subnet. Provision `/etc/nginx/powermeter.htpasswd` interactively (not tracked). Server-level basic auth guards API, static dashboard and WebSocket upgrade; validate browser authenticated WebSocket behavior over TLS. Nginx preserves `/api/...` and upgrades `/ws`; the frontend must use same-origin relative paths. Add rate limits if required. Run `nginx -t` before an explicitly authorized reload.
8. Review `deploy/powermeter.service`, paths/user and resource needs; it runs Node directly, never migrates or seeds. Validate with `systemd-analyze verify` on target before explicitly authorized installation/enabling. Validate Mosquitto config using the installed version's supported check mode or an isolated broker; do not launch a second process on a live port. Service restart loops must not hide missing schema or bad credentials.

## Acceptance on an isolated target, then authorized commissioning

- Query `schema_migrations` and confirm both reviewed checksums, table definitions and expected indexes. Do not run this runner over an untracked legacy schema.
- Check health API database and broker status without exposing connection secrets. Health liveness alone does not prove ingestion.
- Register real devices using the administrative workflow; development seed is prohibited on production. Simulator can use an isolated test database/device identity.
- Verify valid MQTT ingestion produces exactly one row and committed WebSocket update. Replay a non-null message ID and verify no duplicate row/broadcast. Verify unknown/disabled device and cross-device topic spoof are rejected.
- Verify bounded history and deterministic tie-breakers. Compare query plans for latest/history to supplied composite indexes.
- Exercise relay command UUID, publish failure, matching ACK, duplicate ACK, wrong device/state ACK, timeout, and restart with pending command; no unconfirmed success is allowed.
- Test broker outage/reconnect/resubscribe, database outage (no phantom broadcast), graceful shutdown, browser reconnect and host reboot. Check origins/auth from both allowed and forbidden clients.
- Check journald log rotation, absence of credentials and no per-sample production logging. Review retention with dry-run first. Set backup policy and perform the isolated restore drill below before claiming production readiness.

## Backup and restore (manual operator actions)

The POSIX `scripts/backup.sh` and `scripts/restore.sh` are provided for review; they were not run against any server. Use PostgreSQL client tools compatible with the server major version. Set `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` in a protected operator shell and use a locally provisioned `~/.pgpass` (0600), peer auth or a secret manager. Do not put password URIs in shell history/process arguments. Example invocations, only after operator authorization:

```sh
PGDATABASE=powermeter_db sh scripts/backup.sh /mnt/protected-backups
# Create a NEW empty verification database separately, never use the running DB.
PGDATABASE=powermeter_restore_check sh scripts/restore.sh /mnt/protected-backups/backup.complete.dump --apply-to-empty-database
```

Backup creates a private custom-format dump, verifies its archive directory, then labels it `.complete.dump`. This check does not prove full recoverability. It preserves schema and migration tracking; cluster roles/OS files/secrets are not included. Backup role needs sufficient read privileges. Restore refuses existing tables/sequences/views, does not use `--clean` or drop anything, and restores in one transaction without owner/ACL restoration. Provision target role grants separately. Keep the restore target isolated from application writers for the entire check; the emptiness check is not a concurrency lock. Do not run fresh migrations before restoring a complete schema dump.

For a drill: compare device and measurement counts/ranges and recent relay/events, inspect migration history, execute checksums with migration tooling, run API read tests using the restored database in isolation, and verify constraints/indexes. Record dump date, client/server versions, checksum of the backup artifact, duration and outcome. Never promote the restored DB or switch live connection strings automatically.

Proposed backup policy, subject to owner approval: nightly full backup, keep 7 daily + 4 weekly copies, at least one encrypted copy off the Pi/microSD, with monthly restore drills. No scheduler or pruning script is installed. Protect archived data and secrets separately; test backup availability after loss of the Pi. An archive on the same microSD is not disaster recovery.
