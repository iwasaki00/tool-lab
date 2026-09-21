import type { IGameMode } from "../GameMode";

export const stealthMode: IGameMode = {
  id: "STEALTH",
  configure: (config) => ({
    missionType: config.difficulty === "HARD" ? "POWER_RESTORE" : "ACCESS_CONTROL",
    guide: config.difficulty === "EASY" ? "DEBUG" : "NORMAL",
    enemies: true,
    objective: "敵に捕まらずMissionを達成する",
  }),
  scenario: (config, mobile) => ({ enemyCount: config.difficulty === "EASY" ? 2 : config.difficulty === "HARD" ? (mobile ? 6 : 8) : 5, npcCount: mobile ? 2 : 3, discoveryEnabled: false }),
  completeOnMission: true,
  failOnCaught: true,
  countDetections: true,
  debugCompletion: "MISSION",
  ui: { showDetection: true, showDiscovery: false, tutorial: "敵の視界を避けてMissionを達成してください。Detectionが最大になると発見されます。" },
  isDiscoveryComplete: () => false,
  calculateScore: ({ seconds, detections, discovered, landmarkFound, complete }) => complete
    ? Math.max(0, 12000 + Math.max(0, 6000 - Math.floor(seconds * 12)) + (detections === 0 ? 3000 : 0) + discovered * 500 + (landmarkFound ? 2000 : 0) - detections * 750)
    : Math.max(0, discovered * 150),
};
