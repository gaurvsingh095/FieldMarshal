# FieldMarshal — Live judge run-of-show (2:45)

**Live:** https://fieldmarshal-agx.vercel.app/

1. **0:00–0:25 — Setup.** Load Yuma and switch to **Live 3D**. Show three tractors, eight fields, ten work orders. Verify **“3D engine ready”**. Pan/orbit the digital twin.
2. **0:25–0:55 — Dispatch intelligence.** Click a tractor. Open **WHY**; explain the combination of implement compatibility, fuel, route feasibility, priority and deadlines.
3. **0:55–1:35 — Failure recovery.** Use **Run incident demo**. Watch the selected scenario's breakdown and reassignment, then the road closure and priority escalation. Follow the event log. The current source's incident sequence is **T+22, T+50, T+85**, not numbers shown in an earlier judge packet.
4. **1:35–2:20 — Show evidence.** Open **Optimizer vs FCFS**. Compare equal-duration simulated runs under identical events. For final-source incident runs: Yuma 4.18 → 3.50 km (16.3% less traveled), Pinal 4.68 → 4.19 km (10.5% less). Pinal finishes 10 vs 9 jobs; Yuma finishes 9 vs 9 and has 6 on-time vs 7 for FCFS. Do not claim the scheduler wins all metrics.
5. **2:20–2:45 — Export and close.** Switch regions; show the scenario changes and **Export evidence**. Close on how deterministic dispatch, resilient replanning, and 3D visual state use the same engine.

## Backups and limitations

- Browser 3D first-frame and WebGL compatibility must be checked on the actual judging machine. Use **Tactical 2D** if 3D fails.
- Synthetic farm positions, roads, crops, weather, fuel and duration parameters are not on-farm telemetry.
- No physical tractor control, GNSS/telematics, obstacle avoidance, collision protection, or certification.
- Reproduce from repo root with `node --test tests/engine.test.mjs && node src/run-demo.mjs`.
