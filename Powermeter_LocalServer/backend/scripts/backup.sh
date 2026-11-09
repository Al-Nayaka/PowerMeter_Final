#!/bin/sh
set -eu
umask 077
# libpq uses PGHOST/PGPORT/PGUSER/PGDATABASE and ~/.pgpass (0600).
# Do not pass passwords or connection URIs as command-line arguments.
if [ "$#" -ne 1 ] || [ -z "${PGDATABASE:-}" ]; then
    echo 'Usage: PGDATABASE=database sh scripts/backup.sh /secure/backup/directory' >&2
    exit 1
fi
directory=$1
if [ ! -d "$directory" ]; then
    echo 'Backup directory must already exist on protected storage' >&2
    exit 1
fi
temporary=$(mktemp "$directory/powermeter-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX.dump")
trap 'rm -f "$temporary"' EXIT HUP INT TERM
pg_dump --no-password --format=custom --file="$temporary"
pg_restore --list "$temporary" >/dev/null
final="${temporary%.dump}.complete.dump"
mv "$temporary" "$final"
trap - EXIT HUP INT TERM
echo "Backup created: $final"
