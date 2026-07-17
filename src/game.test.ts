import { describe, expect, it } from "vitest";
import { createSession, gameReducer } from "./game";

describe("game reducer", () => {
  it("rematches with the roster but clears scores", () => {
    const session = createSession({ quizId: "quiz", quizFile: "quiz.json", quizFingerprint: "quiz" });
    const withPlayer = gameReducer(session, { type: "ADD_PLAYER", name: "Alice" });
    const started = gameReducer(withPlayer, { type: "START" });
    const awarded = gameReducer(started, { type: "AWARD", questionId: "q1", awards: [{ participantId: withPlayer.players[0].id, points: 2 }] });
    const rematch = gameReducer(awarded, { type: "REMATCH" });
    expect(rematch.players).toHaveLength(1); expect(rematch.questionResults).toEqual([]); expect(rematch.status).toBe("active");
  });
  it("navigates without losing scoring", () => {
    const session = gameReducer(createSession({ quizId: "quiz", quizFile: "quiz.json", quizFingerprint: "quiz" }), { type: "AWARD", questionId: "q1", awards: [{ participantId: "p1", points: 1 }] });
    expect(gameReducer(session, { type: "GO_TO", index: 2 }).questionResults).toEqual(session.questionResults);
  });
});
