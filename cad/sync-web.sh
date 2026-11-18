#!/bin/sh
# Copy the web exports into the site. Run from the repository root after a CAD build.
set -e
mkdir -p public/models data/models
cp cad/hexapod/export/glb/hexapod.glb public/models/hexapod.glb
cp cad/air-quality-monitor/export/glb/aqm.glb public/models/aqm.glb
cp cad/quadruped/export/glb/quadruped.glb public/models/quadruped.glb
cp cad/hydrosafe/export/glb/hydrosafe.glb public/models/hydrosafe.glb
cp cad/cubesat/export/glb/cubesat.glb public/models/cubesat.glb
cp cad/hydrosafe/export/hydrosafe.manifest.json data/models/hydrosafe.manifest.json
cp cad/quadruped/export/quadruped.manifest.json data/models/quadruped.manifest.json
cp cad/cubesat/export/cubesat.manifest.json data/models/cubesat.manifest.json
cp cad/hexapod/export/hexapod.manifest.json data/models/hexapod.manifest.json
cp cad/air-quality-monitor/export/aqm.manifest.json data/models/aqm.manifest.json
ls -la public/models
