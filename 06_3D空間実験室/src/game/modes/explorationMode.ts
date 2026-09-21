import type { IGameMode } from "../GameMode";

export const explorationMode: IGameMode = {
  id: "EXPLORATION",
  configure: () => ({ missionType: "ESCAPE", guide: "OFF", enemies: false, objective: "新しい場所を5か所発見し、ランドマークを訪れる" }),
  scenario: (_config, mobile) => ({ enemyCount: 0, npcCount: mobile ? 4 : 6, discoveryEnabled: true }),
  completeOnMission: false,
  failOnCaught: false,
  countDetections: false,
  debugCompletion: "DISCOVERY",
  ui: { showDetection: false, showDiscovery: true, tutorial: "街の公園・広場・建物を巡り、5か所とランドマークを発見してください。" },
  isDiscoveryComplete: (value) => value.discovered >= value.target && value.buildingsVisited >= value.buildingTarget && value.landmarkFound,
  calculateScore: ({ seconds, detections, discovered, landmarkFound, complete }) => complete
    ? Math.max(0, 5000 + Math.max(0, 6000 - Math.floor(seconds * 12)) + discovered * 500 + (landmarkFound ? 2000 : 0) - detections * 750)
    : Math.max(0, discovered * 150),
};
