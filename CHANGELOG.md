# Changelog

## 1.2.1

- Added NORMAL / STRESS / MOBILE LOW performance profiling and budget diagnostics.
- Reduced draw calls by merging same-material road markings, crosswalks, windows, exterior shells and repeated props without submesh subdivision.
- Reused interior and furniture materials through the shared Material Library.
- Added distance-aware interior visibility, decoration LOD, local-light culling and shadow-caster limits.
- Changed desktop AUTO to the stable MEDIUM profile and retained full shadow quality as explicit HIGH.
- Reduced mobile chunk load/unload radii while preserving streaming hysteresis.
- Stopped detailed debug DOM updates while the DEBUG panel is closed.
- Kept `freezeActiveMeshes` disabled because chunk streaming and dynamic mission objects invalidate a frozen active set.

## 1.2.0

- Added the shared Visual System with environment and quality presets.
- Added procedural sky, lightweight clouds, fog, palette-managed lighting and day/night emissive states.
- Added a cached Material Library for roads, concrete, glass, metal, wood, grass and building surfaces.
- Added deterministic chunk building appearance, window lighting, roof variants and distance-based visual LOD.
- Added visual performance metrics, debug views, Test Bridge APIs, screenshots and Playwright visual tests.

## 1.1.0

- Added World Map System and JSON map format v1.
- Added deterministic procedural chunks and road-edge metadata.
- Added PREBUILT / PROCEDURAL / HYBRID map modes.
- Added map import, export, LocalStorage browser, auto expansion and chunk streaming.
- Added Playwright chunk expansion and round-trip tests.

## 1.0.0

- Initial common 3D framework baseline.
- Added procedural city, semantic world, mission, navigation, NPC/enemy and debug systems.
