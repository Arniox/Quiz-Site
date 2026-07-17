import type { GameSession, LoadedQuizSummary, QuizCatalogItem } from "../models";
import { quizFingerprint } from "../utils";

export interface SavedQuizResolution {
  summary?: LoadedQuizSummary;
  error?: string;
  fingerprintMatches: boolean;
}

export function resolveSavedQuiz(session: GameSession, catalog: QuizCatalogItem[]): SavedQuizResolution {
  if (!session.selectedQuiz) return { fingerprintMatches: false, error: "This saved session predates the multi-quiz library and cannot be matched safely to a quiz." };
  const summary = catalog.find((item) => item.id === session.selectedQuiz?.quizId && item.file === session.selectedQuiz?.quizFile)?.summary;
  if (!summary) return { fingerprintMatches: false, error: `The saved quiz ‘${session.selectedQuiz.quizId}’ is no longer available in the manifest.` };
  return { summary, fingerprintMatches: session.selectedQuiz.quizFingerprint === quizFingerprint(summary.quiz) };
}
