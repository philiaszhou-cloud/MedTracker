# CHANGELOG

All notable changes to the Medtracker project are recorded here.

## 2026-04-13 — Quick fixes & updates

- tsconfig.json: inlined configuration and removed reliance on deprecated TypeScript options; added `verbatimModuleSyntax` and `ignoreDeprecations` to silence deprecation warnings and support newer TypeScript behavior.
- `src/utils/pillCounter.ts`: updated `quickSelect` signature to accept `Float64Array` to fix a type mismatch during histogram processing.
- `src/stores/index.ts`: fixed `getDailyDosage` call to pass a string parameter (avoid number/string mismatch).
- `src/pages/recognize/index.vue`: added annotated-image export logic for H5 (`canvas.toDataURL`) and App (`uni.canvasToTempFilePath`), set `annotatedImagePath`, and pass the annotated image when recording daily photo results.
- Ran `npm run type-check` and resolved reported TypeScript errors; type-check now passes.

Notes:
- These changes were made during an interactive code review and iteration session on 2026-04-13.
- If you prefer Git commits for history, I can create a suggested commit message and patch for you to apply.
