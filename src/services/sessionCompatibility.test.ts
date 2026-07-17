import { describe, expect, it } from "vitest";
import { createSession } from "../game";
import type { LoadedQuizSummary, QuizCatalogItem } from "../models";
import { quizFingerprint } from "../utils";
import { resolveSavedQuiz } from "./sessionCompatibility";

const quiz = { title: "Quiz", questions: [{ id: "q1", question: "Question?", answerType: "single" as const, answers: ["Answer"], points: 1 }] };
const summary: LoadedQuizSummary = { id: "quiz", file: "quiz.json", title: "Quiz", questionCount: 1, totalBasePoints: 1, categories: [], quiz };
const catalog: QuizCatalogItem[] = [{ id: "quiz", file: "quiz.json", summary }];

describe("saved quiz compatibility", () => {
  it("restores the correct quiz", () => expect(resolveSavedQuiz(createSession({ quizId: "quiz", quizFile: "quiz.json", quizFingerprint: quizFingerprint(quiz) }), catalog)).toMatchObject({ summary, fingerprintMatches: true }));
  it("rejects a different fingerprint", () => expect(resolveSavedQuiz(createSession({ quizId: "quiz", quizFile: "quiz.json", quizFingerprint: "old" }), catalog).fingerprintMatches).toBe(false));
  it("handles a quiz no longer present", () => expect(resolveSavedQuiz(createSession({ quizId: "missing", quizFile: "missing.json", quizFingerprint: "old" }), catalog).error).toMatch(/no longer available/i));
});
