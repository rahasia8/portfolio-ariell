#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

# IDE terminals may inherit an older system Node even with .nvmrc present.
if [ "$(node -p 'process.versions.node.split(".")[0]')" != "24" ]; then
  portfolio_nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$portfolio_nvm_dir/nvm.sh" ]; then
    # npm exports its old installation prefix; nvm rejects that inherited value.
    unset npm_config_prefix NPM_CONFIG_PREFIX
    source "$portfolio_nvm_dir/nvm.sh"
    nvm use --silent 24
  else
    echo "Node 24 is required. Activate Node 24 in your terminal, then run npm run dev again." >&2
    exit 1
  fi
fi

exec node node_modules/next/dist/bin/next dev --turbopack "$@"
