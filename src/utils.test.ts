import { describe, expect, it } from "vitest";
import type { ManualScoreAdjustment, QuestionResult } from "./models";
import { createSession } from "./game";
import { calculateParticipantScore, calculateRankings, loadSession, replaceQuestionAwards, saveSession, validateQuiz, validateStart } from "./utils";

describe("quiz validation", () => {
  it("accepts a valid quiz", () => expect(validateQuiz({ title: "Quiz", questions: [{ id: "q1", question: "Ready?", answerType: "single", answers: ["Yes"], points: 1 }] }).title).toBe("Quiz"));
  it("reports duplicate IDs", () => expect(() => validateQuiz({ title: "Quiz", questions: [{ id: "q1", question: "A", answerType: "open", answers: [], points: 1 }, { id: "q1", question: "B", answerType: "open", answers: [], points: 1 }] })).toThrow(/duplicate id/i));
  it("requires answers for single questions", () => expect(() => validateQuiz({ title: "Quiz", questions: [{ id: "q1", question: "A", answerType: "single", answers: [], points: 1 }] })).toThrow(/needs at least one answer/i));
  it("validates displayed multiple-choice answers", () => {
    expect(validateQuiz({ title: "Quiz", questions: [{ id: "q1", question: "A", answerType: "single", answers: ["Correct"], choices: ["Wrong", "Correct"], points: 1 }] }).questions[0].choices).toEqual(["Wrong", "Correct"]);
    expect(() => validateQuiz({ title: "Quiz", questions: [{ id: "q1", question: "A", answerType: "single", answers: ["Correct"], choices: ["Wrong", "Also wrong"], points: 1 }] })).toThrow(/match an accepted answer/i);
  });
});

describe("scoring", () => {
  it("replaces rather than duplicates question awards", () => {
    const first = replaceQuestionAwards([], "q1", [{ participantId: "p1", points: 2 }]);
    const revised = replaceQuestionAwards(first, "q1", [{ participantId: "p1", points: 3 }, { participantId: "p2", points: 1 }]);
    expect(revised).toHaveLength(1); expect(revised[0].awards).toEqual([{ participantId: "p1", points: 3 }, { participantId: "p2", points: 1 }]);
  });
  it("combines awards and manual adjustments", () => {
    const results: QuestionResult[] = [{ questionId: "q1", completed: true, skipped: false, awards: [{ participantId: "p1", points: 3 }] }];
    const adjustments: ManualScoreAdjustment[] = [{ id: "a1", participantId: "p1", points: -1, createdAt: "now" }];
    expect(calculateParticipantScore("p1", results, adjustments)).toBe(2);
  });
  it("uses competition ranking for ties", () => {
    const results: QuestionResult[] = [{ questionId: "q1", completed: true, skipped: false, awards: [{ participantId: "a", points: 10 }, { participantId: "b", points: 10 }, { participantId: "c", points: 8 }] }];
    const rankings = calculateRankings([{ id: "a", name: "Alice", order: 0 }, { id: "b", name: "Bob", order: 1 }, { id: "c", name: "Charlie", order: 2 }], results, []);
    expect(rankings.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
});

describe("session behaviour", () => {
  it("serializes and restores a local session", () => {
    const session = { ...createSession({ quizId: "quiz", quizFile: "quiz.json", quizFingerprint: "quiz" }), currentQuestionIndex: 2 };
    saveSession(session);
    expect(loadSession()).toEqual(session);
    localStorage.clear();
  });

  it("explains invalid team setup", () => {
    const session = { ...createSession({ quizId: "quiz", quizFile: "quiz.json", quizFingerprint: "quiz" }), mode: "teams" as const, players: [{ id: "p1", name: "Alice", teamId: null }] };
    expect(validateStart(session)).toEqual(expect.arrayContaining(["Create at least one team.", "Assign every player to a team (1 unassigned)."]));
  });
});
