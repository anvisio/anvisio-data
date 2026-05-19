#!/usr/bin/env bash
# Install the anvisio-data git hooks. Re-run after `git clone`.
#
# Pre-push hook runs the same CI gates the PR validator runs, but locally
# against your unpushed commits so you catch missing _meta/name/version-bump
# BEFORE pushing instead of after CI fails three times.
#
# USAGE:
#   bash tools-build/install-hooks.sh
#   # or via package.json:
#   pnpm install-hooks

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
SOURCE_DIR="$REPO_ROOT/tools-build/git-hooks"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "ERROR: $SOURCE_DIR does not exist. Are you running this from the repo root?" >&2
  exit 1
fi

# Ensure tools-build deps are installed (the hook needs them).
if [ ! -d "$REPO_ROOT/tools-build/node_modules" ]; then
  echo "Installing tools-build dependencies (one-time setup)..."
  (cd "$REPO_ROOT/tools-build" && npm install --no-audit --no-fund)
fi

# Symlink each hook from the source dir into .git/hooks/. Symlink (not copy)
# so the hook stays in sync with the tracked source.
installed=()
for hook in "$SOURCE_DIR"/*; do
  name="$(basename "$hook")"
  target="$HOOKS_DIR/$name"

  # If a non-symlink hook already exists, back it up.
  if [ -f "$target" ] && [ ! -L "$target" ]; then
    mv "$target" "$target.local-backup"
    echo "  backed up existing $name → $name.local-backup"
  fi

  ln -sf "$hook" "$target"
  chmod +x "$hook"
  installed+=("$name")
done

echo ""
echo "✓ Installed git hooks: ${installed[*]}"
echo ""
echo "To test the pre-push hook without pushing:"
echo "  bash tools-build/git-hooks/pre-push"
