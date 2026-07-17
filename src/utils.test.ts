import { describe, expect, it } from "vitest";
import type { ManualScoreAdjustment, QuestionResult } from "./models";
import { createSession } from "./game";
import { calculateParticipantScore, calculateRankings, getQuestionProgressStatus, loadSession, replaceQuestionAwards, saveSession, shuffleQuestionChoices, validateQuiz, validateStart } from "./utils";

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

describe("choice shuffling", () => {
  it("shuffles each choice list without changing its contents", () => {
    const quiz = validateQuiz({ title: "Quiz", questions: [{ id: "q1", question: "A", answerType: "single", answers: ["A"], choices: ["A", "B", "C", "D"], points: 1 }] });
    const order = shuffleQuestionChoices(quiz, () => 0);
    expect(order.q1).toEqual(["B", "C", "D", "A"]);
    expect([...order.q1].sort()).toEqual(["A", "B", "C", "D"]);
    expect(quiz.questions[0].choices).toEqual(["A", "B", "C", "D"]);
  });
  it("never leaves a choice list in its authoring order", () => {
    const quiz = validateQuiz({ title: "Quiz", questions: [{ id: "q1", question: "A", answerType: "single", answers: ["A"], choices: ["A", "B", "C", "D"], points: 1 }] });
    expect(shuffleQuestionChoices(quiz, () => 0.999).q1).toEqual(["B", "C", "D", "A"]);
  });
});

describe("question progress", () => {
  it("distinguishes unseen, viewed, zero-score, scored, and skipped questions", () => {
    expect(getQuestionProgressStatus("q1", [], [])).toBe("unseen");
    expect(getQuestionProgressStatus("q1", [], ["q1"])).toBe("viewed");
    expect(getQuestionProgressStatus("q1", [{ questionId: "q1", awards: [], completed: true, skipped: false }], ["q1"])).toBe("no-correct");
    expect(getQuestionProgressStatus("q1", [{ questionId: "q1", awards: [{ participantId: "p1", points: 1 }], completed: true, skipped: false }], ["q1"])).toBe("scored");
    expect(getQuestionProgressStatus("q1", [{ questionId: "q1", awards: [], completed: true, skipped: true }], ["q1"])).toBe("skipped");
  });
});
