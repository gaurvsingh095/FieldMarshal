#!/usr/bin/env bash
# Builds dist/index.html: one self-contained file (app + engine + Three.js + CSS + scenarios), no CDN.
set -euo pipefail
cd "$(dirname "$0")/.."
npx --yes esbuild@0.24.0 src/app.mjs --bundle --format=esm --minify \
  --alias:three/addons=./vendor/three/addons --alias:three=./vendor/three/three.module.min.js \
  --outfile=dist/app.bundle.js --log-level=warning
python3 - <<'PY'
import re
h=open('index.html').read();css=open('src/style.css').read();js=open('dist/app.bundle.js').read().replace('</script','<\\/script')
h=re.sub(r'<script type="importmap">.*?</script>','',h,flags=re.S)
h=h.replace('<link rel="stylesheet" href="./src/style.css">','<style>'+css+'</style>')
h=h.replace('<script type="module" src="./src/app.mjs"></script>','<script type="module">'+js+'</script>')
open('dist/index.html','w').write(h);print('dist/index.html',len(h),'bytes')
PY
rm dist/app.bundle.js
