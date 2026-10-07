#!/usr/bin/env bash
# repo_snapshot.sh — Linux/macOS counterpart of repo_snapshot.ps1
# Emits the same JSON shape so the wrap procedure is identical on every platform.
# Usage: repo_snapshot.sh <project-path> [max-depth]
set -uo pipefail

PROJECT_PATH="${1:-.}"
MAX_DEPTH="${2:-3}"

case "$MAX_DEPTH" in
  ''|*[!0-9]*) echo "max-depth must be an integer 0-8" >&2; exit 2 ;;
esac
[ "$MAX_DEPTH" -gt 8 ] && { echo "max-depth must be 0-8" >&2; exit 2; }

command -v git >/dev/null 2>&1 || { echo "git not found on PATH" >&2; exit 3; }
[ -d "$PROJECT_PATH" ] || { echo "no such directory: $PROJECT_PATH" >&2; exit 2; }

PROJECT_ABS=$(cd "$PROJECT_PATH" && pwd -P)

EXCLUDED=".git .cache .next .venv build coverage dist node_modules out target venv"
is_excluded() {
  for e in $EXCLUDED; do [ "$1" = "$e" ] && return 0; done
  return 1
}

# JSON string escaping: backslash, quote, control chars, newlines.
jesc() {
  printf '%s' "${1-}" \
    | LC_ALL=C sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/\\t/g' -e 's/\r/\\r/g' \
    | LC_ALL=C tr -d '\000-\010\013\014\016-\037' \
    | awk 'BEGIN{ORS=""} NR>1{printf "\\n"} {print}'
}
jarr() {  # each argument line on stdin becomes one JSON string element
  local first=1 line out=""
  while IFS= read -r line; do
    [ $first -eq 1 ] && first=0 || out="$out,"
    out="$out\"$(jesc "$line")\""
  done
  printf '[%s]' "$out"
}

REPOS=""
BROKEN=""
SEEN=""

add_repo() {
  local p="$1" abs
  abs=$(cd "$p" 2>/dev/null && pwd -P) || return 0
  case ":$SEEN:" in *":$abs:"*) return 0 ;; esac
  SEEN="$SEEN:$abs"
  REPOS="$REPOS$abs
"
}
add_broken() {
  local abs="$1"
  case ":$SEEN:" in *":$abs:"*) return 0 ;; esac
  SEEN="$SEEN:$abs"
  BROKEN="$BROKEN$abs
"
}
# A directory holding a .git entry is only a repository if git agrees it is the
# root. Otherwise git silently answers for the PARENT repository, and a corrupt
# or half-copied .git gets reported as a healthy repo with someone else's state.
is_repo_root() {
  local dir="$1" abs top
  abs=$(cd "$dir" 2>/dev/null && pwd -P) || return 1
  top=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null) || return 1
  [ -n "$top" ] || return 1
  top=$(cd "$top" 2>/dev/null && pwd -P) || return 1
  [ "$abs" = "$top" ]
}

# The project's own repository, if the path sits inside one.
if root=$(git -C "$PROJECT_ABS" rev-parse --show-toplevel 2>/dev/null) && [ -n "$root" ]; then
  add_repo "$root"
fi

# Breadth-first walk; stop descending a branch once a repository is found.
walk() {
  local dir="$1" depth="$2" child base
  [ "$depth" -gt "$MAX_DEPTH" ] && return 0
  for child in "$dir"/*/ "$dir"/.*/ ; do
    [ -d "$child" ] || continue
    base=$(basename "$child")
    [ "$base" = "." ] || [ "$base" = ".." ] && continue
    is_excluded "$base" && continue
    if [ -e "$child/.git" ]; then
      if is_repo_root "$child"; then
        add_repo "$child"
      else
        add_broken "$(cd "$child" && pwd -P)"
      fi
      continue          # documented limit: nested-inside-nested is not searched
    fi
    [ "$depth" -lt "$MAX_DEPTH" ] && walk "${child%/}" $((depth + 1))
  done
}
[ "$MAX_DEPTH" -gt 0 ] && walk "$PROJECT_ABS" 1

snapshot() {
  local p="$1" branch head status_out recent_out ok err
  ok=true; err=""
  branch=$(git -C "$p" branch --show-current 2>/dev/null) || true
  if ! head=$(git -C "$p" rev-parse --short HEAD 2>&1); then
    ok=false; err="$head"; head=""
  fi
  if ! status_out=$(git -C "$p" status --short 2>&1); then
    ok=false; err="$status_out"; status_out=""
  fi
  recent_out=$(git -C "$p" log -3 --pretty=format:'%h %s' 2>/dev/null) || recent_out=""

  local status_json recent_json clean
  status_json=$([ -n "$status_out" ] && printf '%s\n' "$status_out" | jarr || printf '[]')
  recent_json=$([ -n "$recent_out" ] && printf '%s\n' "$recent_out" | jarr || printf '[]')
  # A repository git could not read is NOT clean — it is unknown.
  if [ "$ok" = true ] && [ -z "$status_out" ]; then clean=true; else clean=false; fi

  printf '{"path":"%s","branch":"%s","head":"%s","ok":%s,"error":"%s","clean":%s,"status":%s,"recent_commits":%s}' \
    "$(jesc "$p")" "$(jesc "$branch")" "$(jesc "$head")" "$ok" "$(jesc "$err")" \
    "$clean" "$status_json" "$recent_json"
}

BODY=""; COUNT=0; FIRST=1
while IFS= read -r r; do
  [ -z "$r" ] && continue
  [ $FIRST -eq 1 ] && FIRST=0 || BODY="$BODY,"
  BODY="$BODY$(snapshot "$r")"
  COUNT=$((COUNT + 1))
done <<EOF
$(printf '%s' "$REPOS" | LC_ALL=C sort)
EOF

# Surface unreadable .git directories instead of dropping or mis-reporting them.
UNREADABLE=""; UFIRST=1
while IFS= read -r r; do
  [ -z "$r" ] && continue
  [ $UFIRST -eq 1 ] && UFIRST=0 || UNREADABLE="$UNREADABLE,"
  UNREADABLE="$UNREADABLE\"$(jesc "$r")\""
done <<EOF
$(printf '%s' "$BROKEN" | LC_ALL=C sort)
EOF

printf '{\n  "project": "%s",\n  "captured_at": "%s",\n  "discovery_max_depth": %s,\n  "repository_count": %s,\n  "unreadable_git_dirs": [%s],\n  "repositories": [%s]\n}\n' \
  "$(jesc "$PROJECT_ABS")" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$MAX_DEPTH" "$COUNT" "$UNREADABLE" "$BODY"
