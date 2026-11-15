# Engineering and reproducibility

**Architecture:** Static browser app (`index.html`, `src/app.mjs`, `src/style.css`) + deterministic fleet simulator (`src/engine.mjs`) + Three.js WebGL view (`src/twin3d.mjs`) + locally vendored Three.js r170 MIT library (`vendor/three/`). The production-oriented standalone build is `dist/index.html`.

**Decision model:** Filter incompatible or unavailable tractor/job pairs and infeasible routes/fuel reserve; score eligible work by priority, travel, duration and deadlines; assign without duplication. Dijkstra routes over a simulated road graph and responds to edge closures. Replan interrupted work while retaining progress and completed jobs.

**Regional datasets:** `scenarios/yuma-winter.json`, `scenarios/pinal-fall.json`, each 3 tractors, 8 fields and 10 jobs. These are **synthetic** despite regionally appropriate crop types.

**Reproduce benchmark:** `node src/run-demo.mjs`; artifact `artifacts/baseline-comparison.json`. The baseline and heuristic use matching scenario definitions, simulated disruptions and a 180-minute clock. Observe all tradeoffs, not just travel.

**Test:** `node --test tests/engine.test.mjs` (13 passed on 2026-11-15). Source package includes Playwright browser checks; in an environment with Chrome and Playwright, see `tests/browser/e2e.py` and the root README.

**No real-world claims:** No GPS-driven tractors, autonomous controls, certified safety system, real farm telemetry, or measured cost or emissions reductions.
