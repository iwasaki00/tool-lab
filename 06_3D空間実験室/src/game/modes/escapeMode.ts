import type { IGameMode } from "../GameMode";

export const escapeMode: IGameMode = {
  id: "ESCAPE",
  configure: (config) => ({
    missionType: config.difficulty === "EASY" ? "ESCAPE" : config.difficulty === "HARD" ? "MULTI_BUILDING" : "ACCESS_CONTROL",
    guide: config.difficulty === "EASY" ? "DEBUG" : "NORMAL",
    enemies: true,
    objective: "Missionを達成して脱出する",
  }),
  scenario: (config, mobile) => ({ enemyCount: config.difficulty === "EASY" ? 0 : config.difficulty === "HARD" ? 4 : 2, npcCount: mobile ? 2 : 3, discoveryEnabled: false }),
  completeOnMission: true,
  failOnCaught: false,
  countDetections: false,
  debugCompletion: "MISSION",
  ui: { showDetection: false, showDiscovery: false, tutorial: "案内を追い、鍵やカードキーを集めてGoalへ到達してください。" },
  isDiscoveryComplete: () => false,
  calculateScore: ({ seconds, detections, discovered, landmarkFound, complete }) => complete
    ? Math.max(0, 10000 + Math.max(0, 6000 - Math.floor(seconds * 12)) + discovered * 500 + (landmarkFound ? 2000 : 0) - detections * 750)
    : Math.max(0, discovered * 150),
};
