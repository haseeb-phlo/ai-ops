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

// Subtopics nested under a parent topic. Order in the array drives the
// render order on the Learn page. Subtopic keys must be globally unique
// so the DB CHECK constraint can validate them with a single list; the
// topic→subtopic relationship is enforced in the Server Action.
export type LearnSubtopic = "claude";

export const LEARN_SUBTOPICS: Partial<
  Record<LearnTopic, readonly LearnSubtopic[]>
> = {
  ai_tools: ["claude"],
};

export const LEARN_SUBTOPIC_LABEL: Record<LearnSubtopic, string> = {
  claude: "Claude",
};

export function isValidSubtopic(
  topic: LearnTopic,
  subtopic: string,
): subtopic is LearnSubtopic {
  return ((LEARN_SUBTOPICS[topic] ?? []) as readonly string[]).includes(
    subtopic,
  );
}

export const VIDEO_RESOURCE_MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
export const VIDEO_RESOURCE_BUCKET = "learn-video-resources";
