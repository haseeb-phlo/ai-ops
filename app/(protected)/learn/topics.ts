export type ActionState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success" };

export const LEARN_TOPICS = [
  "ai_ops",
  "ai_foundations",
  "prompt_engineering",
  "ai_tools",
] as const;
export type LearnTopic = (typeof LEARN_TOPICS)[number];

export const LEARN_TOPIC_LABEL: Record<LearnTopic, string> = {
  ai_ops: "AI Ops",
  ai_foundations: "AI Foundations",
  prompt_engineering: "Prompt Engineering",
  ai_tools: "AI Tools",
};

export const VIDEO_RESOURCE_MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
export const VIDEO_RESOURCE_BUCKET = "learn-video-resources";
