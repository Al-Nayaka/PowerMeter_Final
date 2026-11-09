#!/bin/sh
set -eu
umask 077
if [ "$#" -ne 2 ] || [ "$2" != '--apply-to-empty-database' ] || [ -z "${PGDATABASE:-}" ]; then
    echo 'Usage: PGDATABASE=fresh_database sh scripts/restore.sh backup.complete.dump --apply-to-empty-database' >&2
    exit 1
fi
if [ ! -f "$1" ]; then
    echo 'Backup file does not exist' >&2
    exit 1
fi
pg_restore --list "$1" >/dev/null
objects=$(psql --no-password -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','S','f');")
if [ "$objects" != '0' ]; then
    echo 'Refusing restore: target database is not empty' >&2
    exit 1
fi
# No --clean, no drop database, no destructive rollback.
pg_restore --no-password --exit-on-error --single-transaction --no-owner --no-privileges --dbname="$PGDATABASE" "$1"
echo 'Restore completed; validate offline before pointing a service at this database'
