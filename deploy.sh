#!/bin/bash
cd "$(dirname "$0")"
git add -A
git commit -m "Update site assets"
git push
echo "✓ Deployed"
