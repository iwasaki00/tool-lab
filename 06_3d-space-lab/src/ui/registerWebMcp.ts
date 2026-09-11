interface WebMcpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
}

interface ModelContext {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => void | Promise<void>;
}

declare global {
  interface Document {
    readonly modelContext?: ModelContext;
  }
}

export interface AgentSceneActions {
  addObject: (type: "box" | "sphere" | "building") => void;
  setTime: (mode: "day" | "night") => void;
  randomize: () => void;
  getStatus: () => Record<string, unknown>;
}

export function registerWebMcp(actions: AgentSceneActions): () => void {
  const context = document.modelContext;
  if (!context?.registerTool) return () => undefined;
  const lifecycle = new AbortController();
  const register = (tool: WebMcpTool) => {
    try {
      void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(console.error);
    } catch (error) {
      console.error(error);
    }
  };
  const mutable = { readOnlyHint: false, untrustedContentHint: false };

  register({
    name: "add_scene_object",
    title: "3Dオブジェクトを追加",
    description: "現在の3D実験フィールドへ箱、球、または建物を1つ追加します。",
    inputSchema: { type: "object", properties: { type: { type: "string", enum: ["box", "sphere", "building"] } }, required: ["type"], additionalProperties: false },
    annotations: mutable,
    execute: (input) => {
      const type = (input as { type?: unknown })?.type;
      if (type !== "box" && type !== "sphere" && type !== "building") throw new Error("type must be box, sphere, or building");
      actions.addObject(type);
      return { added: type, status: actions.getStatus() };
    },
  });
  register({
    name: "set_scene_time",
    title: "昼夜を切り替え",
    description: "3D実験フィールドを昼または夜の照明へ切り替えます。",
    inputSchema: { type: "object", properties: { mode: { type: "string", enum: ["day", "night"] } }, required: ["mode"], additionalProperties: false },
    annotations: mutable,
    execute: (input) => {
      const mode = (input as { mode?: unknown })?.mode;
      if (mode !== "day" && mode !== "night") throw new Error("mode must be day or night");
      actions.setTime(mode);
      return { mode };
    },
  });
  register({
    name: "randomize_scene",
    title: "シーンをランダム配置",
    description: "生成済みオブジェクトを消去し、実験オブジェクトをランダムに再配置します。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: mutable,
    execute: () => {
      actions.randomize();
      return { randomized: true, status: actions.getStatus() };
    },
  });
  register({
    name: "get_scene_status",
    title: "シーン状態を取得",
    description: "現在のオブジェクト数、時間帯、プレイヤー位置を取得します。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: () => actions.getStatus(),
  });

  return () => lifecycle.abort();
}
