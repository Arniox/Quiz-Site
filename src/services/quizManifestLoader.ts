import type { QuizManifest, QuizManifestEntry } from "../models";

export function isSafeQuizPath(file: string): boolean {
  if (!file || file.startsWith("/") || file.includes("\\") || file.split("/").includes("..")) return false;
  if (/^[a-z][a-z\d+.-]*:/i.test(file) || /^[a-z]:/i.test(file)) return false;
  return file.split("/").every((segment) => segment.length > 0 && segment !== ".") && file.toLowerCase().endsWith(".json");
}

export function validateManifest(data: unknown): QuizManifest {
  if (!data || typeof data !== "object" || !Array.isArray((data as Record<string, unknown>).quizzes)) throw new Error("The manifest must contain a ‘quizzes’ array.");
  const ids = new Set<string>();
  const quizzes = (data as { quizzes: unknown[] }).quizzes.map((raw, index): QuizManifestEntry => {
    if (!raw || typeof raw !== "object") throw new Error(`Manifest entry ${index + 1} must be an object.`);
    const entry = raw as Record<string, unknown>;
    if (typeof entry.id !== "string" || !entry.id.trim()) throw new Error(`Manifest entry ${index + 1} is missing a stable id.`);
    if (ids.has(entry.id)) throw new Error(`Duplicate quiz id ‘${entry.id}’ in the manifest.`);
    ids.add(entry.id);
    if (typeof entry.file !== "string" || !entry.file.trim()) throw new Error(`Manifest entry ‘${entry.id}’ is missing a filename.`);
    if (!isSafeQuizPath(entry.file)) throw new Error(`Manifest entry ‘${entry.id}’ has an unsafe quiz path: ${entry.file}`);
    return { id: entry.id, file: entry.file };
  });
  return { quizzes };
}

export async function loadQuizManifest(fetcher: typeof fetch = fetch): Promise<QuizManifest> {
  const response = await fetcher("/quizzes/index.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`The quiz manifest could not be fetched (HTTP ${response.status}). Expected public/quizzes/index.json.`);
  try { return validateManifest(await response.json()); }
  catch (error) { throw new Error(`The quiz manifest is invalid: ${error instanceof Error ? error.message : "Unknown error"}`, { cause: error }); }
}
