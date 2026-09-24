#!/usr/bin/env sh
set -eu
config=$(mktemp -d)
types_config="$config/wrangler.json"
trap 'rm -f "$types_config"; rmdir "$config"' EXIT
cat > "$types_config" <<'JSON'
{"name":"algorithm-course-types","compatibility_date":"2026-05-15","compatibility_flags":["nodejs_compat"],"d1_databases":[{"binding":"DB","database_name":"type-only","database_id":"00000000-0000-4000-8000-000000000000"}]}
JSON
WRANGLER_LOG_PATH=.wrangler/types.log node node_modules/wrangler/bin/wrangler.js types worker-configuration.d.ts --config "$types_config"
