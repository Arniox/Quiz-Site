import { describe, expect, it } from "vitest";
import { createSession, gameReducer } from "./game";

describe("game reducer", () => {
  it("rematches with the roster but clears scores", () => {
    const session = createSession({ quizId: "quiz", quizFile: "quiz.json", quizFingerprint: "quiz" });
    const withPlayer = gameReducer(session, { type: "ADD_PLAYER", name: "Alice" });
    const started = gameReducer(withPlayer, { type: "START", choiceOrder: { q1: ["B", "A"] }, firstQuestionId: "q1" });
    const awarded = gameReducer(started, { type: "AWARD", questionId: "q1", awards: [{ participantId: withPlayer.players[0].id, points: 2 }] });
    const rematch = gameReducer(awarded, { type: "REMATCH", choiceOrder: { q1: ["A", "B"] }, firstQuestionId: "q1" });
    expect(rematch.players).toHaveLength(1); expect(rematch.questionResults).toEqual([]); expect(rematch.status).toBe("active");
  });
  it("navigates without losing scoring", () => {
    const session = gameReducer(createSession({ quizId: "quiz", quizFile: "quiz.json", quizFingerprint: "quiz" }), { type: "AWARD", questionId: "q1", awards: [{ participantId: "p1", points: 1 }] });
    const navigated = gameReducer(session, { type: "GO_TO", index: 2, questionId: "q3" });
    expect(navigated.questionResults).toEqual(session.questionResults);
    expect(navigated.viewedQuestionIds).toContain("q3");
  });

  it("stores a stable shuffled choice order when a game starts", () => {
    const started = gameReducer(createSession(null), { type: "START", choiceOrder: { q1: ["C", "A", "B"] }, firstQuestionId: "q1" });
    expect(started.choiceOrder.q1).toEqual(["C", "A", "B"]);
    expect(started.viewedQuestionIds).toEqual(["q1"]);
  });
});
