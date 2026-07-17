import type { LoadedQuizSummary, QuizCatalogItem, QuizManifestEntry } from "../models";
import { validateQuiz } from "./quizValidation";

export async function loadQuiz(entry: QuizManifestEntry, fetcher: typeof fetch = fetch): Promise<LoadedQuizSummary> {
  const response = await fetcher(`/quizzes/${entry.file}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${entry.file} (HTTP ${response.status}).`);
  let raw: unknown;
  try { raw = await response.json(); }
  catch { throw new Error(`${entry.file} does not contain valid JSON.`); }
  try {
    const quiz = validateQuiz(raw);
    return {
      id: entry.id,
      file: entry.file,
      title: quiz.title,
      description: quiz.description,
      questionCount: quiz.questions.length,
      totalBasePoints: quiz.questions.reduce((sum, question) => sum + question.points, 0),
      categories: [...new Set(quiz.questions.map((question) => question.category).filter((category): category is string => !!category))],
      quiz
    };
  } catch (error) { throw new Error(`${entry.file}: ${error instanceof Error ? error.message : "Unknown validation error"}`, { cause: error }); }
}

export async function loadQuizCatalog(entries: QuizManifestEntry[], fetcher: typeof fetch = fetch): Promise<QuizCatalogItem[]> {
  return Promise.all(entries.map(async (entry) => {
    try { return { ...entry, summary: await loadQuiz(entry, fetcher) }; }
    catch (error) { return { ...entry, error: error instanceof Error ? error.message : "Unknown loading error" }; }
  }));
}
