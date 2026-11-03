#!/usr/bin/env bash
set -euo pipefail

export OPENSEARCH_INITIAL_ADMIN_PASSWORD="${OPENSEARCH_PASSWORD:?OPENSEARCH_PASSWORD is required}"
exec /usr/share/opensearch/opensearch-docker-entrypoint.sh "$@"
