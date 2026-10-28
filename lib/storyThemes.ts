/** Story image background colours users can pick from (shared by the image route and the share modal). */
export const STORY_THEMES = {
  yellow: { bg: "#FFE600", label: "Yellow" },
  pink: { bg: "#FF2E93", label: "Pink" },
  cyan: { bg: "#00F0FF", label: "Cyan" },
} as const;

export type StoryTheme = keyof typeof STORY_THEMES;

export function parseStoryTheme(value: string | null): StoryTheme {
  return value && value in STORY_THEMES ? (value as StoryTheme) : "yellow";
}
