#!/bin/sh
# NOTE: intentionally NOT using `set -e` here.
#
# This script sits directly on the container cold-start critical path: it runs
# on EVERY boot before `node server.js` binds port 3000, and Cloudflare's proxy
# will report "Container is taking too long to accept the connection" if the
# port never comes up. The NEXT_PUBLIC_* placeholder swap below is a best-effort
# convenience (it only matters for bundles the standalone server serves itself);
# a failure in it must NEVER prevent the Next.js server from starting. With
# `set -e` a single non-zero exit from `find`/`sed` (e.g. a transient FS error)
# would abort the whole script, the port would never bind, and the request would
# fail with that exact proxy timeout. So we run the swap defensively and always
# fall through to `exec "$@"`.

# ── Replace NEXT_PUBLIC_* placeholders with real env var values ────────────
#
# Next.js inlines NEXT_PUBLIC_* values into the client bundle at build time.
# The Dockerfile sets unique placeholder strings (e.g. __NEXT_PUBLIC_BASE_URL__)
# so they end up in the compiled JS. This script replaces those placeholders
# with the actual runtime env var values before the server starts, keeping
# the Docker image environment-agnostic.

# Directory containing the built JS files
SEARCH_DIR="/app/.next"

# Each entry: "PLACEHOLDER|ENV_VAR_NAME|DEFAULT_VALUE"
#
# Note: NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT, NEXT_PUBLIC_DISCOUNT_PERCENT
# and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY are intentionally NOT swapped here —
# they're baked in at build time via Docker ARGs so the values survive into
# the headless asset bundles uploaded to R2 (which this runtime sed can't
# reach). See the Dockerfile for details.
REPLACEMENTS="
__NEXT_PUBLIC_BASE_URL__|NEXT_PUBLIC_BASE_URL|
__NEXT_PUBLIC_ASSET_PREFIX__|NEXT_PUBLIC_ASSET_PREFIX|
"

# CRITICAL: preserve the original command (the Docker CMD, e.g.
# `node server.js`) BEFORE we build the sed argument list.
#
# We build the combined `sed -e ... -e ...` argument list in the shell's
# positional parameters (`$@`) because that's the only array POSIX sh gives
# us. But `$@` currently holds the command we must eventually `exec` to start
# the server. If we clobber `$@` with sed args and then `exec "$@"`, we would
# exec the leftover `-e "s|...|...|g"` strings INSTEAD of `node server.js`:
# the server would never start, port 3000 would never bind, and Cloudflare's
# proxy would fail every request with "Container is taking too long to accept
# the connection". So we stash the original args in a delimited string first,
# then rebuild them for the final `exec` after the swap is done.
#
# CMD args are joined on a newline (\n) — safe because none of this image's
# CMD tokens (`node`, `server.js`) contain a newline.
CMD_ARGS=""
for arg in "$@"; do
  if [ -z "$CMD_ARGS" ]; then
    CMD_ARGS="$arg"
  else
    CMD_ARGS="$CMD_ARGS
$arg"
  fi
done

# Build a single combined `sed` expression so we walk the .next tree only
# once (instead of once per placeholder). This runs on EVERY container boot
# before `node server.js`, so it sits directly on the cold-start critical
# path — the faster it finishes, the sooner the server binds port 3000 and
# the less likely Cloudflare's proxy is to time out with "Container is taking
# too long to accept the connection".
# Accumulate every placeholder→value pair into ONE combined `sed` script so
# we walk the .next tree a single time and rewrite each file at most once —
# instead of the previous one-full-tree-walk-and-rewrite *per placeholder*.
set --
for entry in $REPLACEMENTS; do
  [ -z "$entry" ] && continue

  placeholder=$(echo "$entry" | cut -d'|' -f1)
  var_name=$(echo "$entry" | cut -d'|' -f2)
  default_val=$(echo "$entry" | cut -d'|' -f3)

  # Use the env var value if set, otherwise fall back to the default
  eval "real_val=\${$var_name:-$default_val}"

  # Collect as separate `-e <script>` positional args so values containing
  # spaces or shell metacharacters are passed to sed safely (no word-split).
  set -- "$@" -e "s|${placeholder}|${real_val}|g"
done

if [ "$#" -gt 0 ]; then
  # Single tree walk, single sed invocation per file (batched via `+`), all
  # substitutions applied at once. This runs on EVERY container boot before
  # `node server.js`, so keeping it to one pass minimises cold-start latency
  # — the faster placeholders are swapped, the sooner the server binds port
  # 3000 and the less likely Cloudflare's proxy is to time out with
  # "Container is taking too long to accept the connection".
  #
  # Best-effort: the trailing `|| ...` swallows any non-zero exit from the
  # walk/sed so a transient FS hiccup can never abort the boot before the
  # server starts. The server reads NEXT_PUBLIC_* from its own env regardless;
  # this swap only patches the client bundles the standalone server serves.
  if find "$SEARCH_DIR" -type f -name '*.js' -exec sed -i "$@" {} +; then
    echo "✅ NEXT_PUBLIC_* placeholders replaced with runtime values"
  else
    echo "⚠️  NEXT_PUBLIC_* placeholder swap failed — starting server anyway" >&2
  fi
else
  echo "ℹ️  No NEXT_PUBLIC_* placeholders configured — skipping swap"
fi

# Restore the original command (the Docker CMD, e.g. `node server.js`) that we
# stashed in CMD_ARGS before `$@` was repurposed for the sed args, then hand
# off to it. We re-split CMD_ARGS on newlines using a temporarily-narrowed IFS
# so each CMD token becomes its own positional parameter again.
OLD_IFS=$IFS
IFS='
'
# Intentionally unquoted so IFS word-splitting rebuilds the positional params.
# shellcheck disable=SC2086
set -- $CMD_ARGS
IFS=$OLD_IFS

# Hand off to the original command (node server.js). If for some reason no CMD
# was provided, fall back to booting the Next.js standalone server directly so
# the port always binds.
if [ "$#" -eq 0 ]; then
  echo "⚠️  No CMD provided — defaulting to 'node server.js'" >&2
  set -- node server.js
fi
exec "$@"
