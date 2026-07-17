import type { GameSession, ManualScoreAdjustment, Player, QuestionResult, QuizMode, ScoreAward, SelectedQuizReference, Team } from "./models";
import { createId, replaceQuestionAwards } from "./utils";

export type GameAction =
  | { type: "ADD_PLAYER"; name: string }
  | { type: "UPDATE_PLAYER"; playerId: string; name: string }
  | { type: "REMOVE_PLAYER"; playerId: string }
  | { type: "MOVE_PLAYER"; playerId: string; direction: -1 | 1 }
  | { type: "SET_MODE"; mode: QuizMode }
  | { type: "ADD_TEAM"; name: string }
  | { type: "UPDATE_TEAM"; teamId: string; name: string }
  | { type: "REMOVE_TEAM"; teamId: string }
  | { type: "ASSIGN_PLAYER"; playerId: string; teamId: string | null }
  | { type: "AUTO_DISTRIBUTE" }
  | { type: "START"; choiceOrder: Record<string, string[]>; firstQuestionId: string }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "GO_TO"; index: number; questionId: string }
  | { type: "REVEAL"; value: boolean }
  | { type: "AWARD"; questionId: string; awards: ScoreAward[] }
  | { type: "SKIP"; questionId: string }
  | { type: "ADJUST"; adjustment: ManualScoreAdjustment }
  | { type: "UNDO_ADJUSTMENT"; adjustmentId: string }
  | { type: "FINISH" }
  | { type: "RETURN_TO_SETUP" }
  | { type: "REMATCH"; choiceOrder: Record<string, string[]>; firstQuestionId: string }
  | { type: "RESTORE"; session: GameSession };

export function createSession(selectedQuiz: SelectedQuizReference | null): GameSession {
  return { version: 1, fingerprint: selectedQuiz?.quizFingerprint ?? "", selectedQuiz, status: "setup", mode: "individual", players: [], teams: [], currentQuestionIndex: 0, choiceOrder: {}, viewedQuestionIds: [], questionResults: [], adjustments: [], answerRevealed: false, startedAt: null, elapsedBeforePause: 0, pausedAt: null };
}

export function gameReducer(state: GameSession, action: GameAction): GameSession {
  switch (action.type) {
    case "ADD_PLAYER": {
      const player: Player = { id: createId("player"), name: action.name, teamId: null };
      return { ...state, players: [...state.players, player] };
    }
    case "UPDATE_PLAYER": return { ...state, players: state.players.map((p) => p.id === action.playerId ? { ...p, name: action.name } : p) };
    case "REMOVE_PLAYER": return { ...state, players: state.players.filter((p) => p.id !== action.playerId), teams: state.teams.map((t) => ({ ...t, playerIds: t.playerIds.filter((id) => id !== action.playerId) })) };
    case "MOVE_PLAYER": {
      const index = state.players.findIndex((p) => p.id === action.playerId);
      const target = index + action.direction;
      if (index < 0 || target < 0 || target >= state.players.length) return state;
      const players = [...state.players];
      [players[index], players[target]] = [players[target], players[index]];
      return { ...state, players };
    }
    case "SET_MODE": return { ...state, mode: action.mode };
    case "ADD_TEAM": {
      const team: Team = { id: createId("team"), name: action.name, playerIds: [] };
      return { ...state, teams: [...state.teams, team] };
    }
    case "UPDATE_TEAM": return { ...state, teams: state.teams.map((t) => t.id === action.teamId ? { ...t, name: action.name } : t) };
    case "REMOVE_TEAM": return { ...state, teams: state.teams.filter((t) => t.id !== action.teamId), players: state.players.map((p) => p.teamId === action.teamId ? { ...p, teamId: null } : p) };
    case "ASSIGN_PLAYER": return { ...state, players: state.players.map((p) => p.id === action.playerId ? { ...p, teamId: action.teamId } : p), teams: state.teams.map((t) => ({ ...t, playerIds: t.playerIds.filter((id) => id !== action.playerId).concat(t.id === action.teamId ? action.playerId : []) })) };
    case "AUTO_DISTRIBUTE": {
      if (!state.teams.length) return state;
      const teams = state.teams.map((team) => ({ ...team, playerIds: [] as string[] }));
      const players = state.players.map((player, index) => {
        const team = teams[index % teams.length]; team.playerIds.push(player.id); return { ...player, teamId: team.id };
      });
      return { ...state, players, teams };
    }
    case "START": return { ...state, status: "active", choiceOrder: action.choiceOrder, viewedQuestionIds: [action.firstQuestionId], startedAt: new Date().toISOString(), pausedAt: null, elapsedBeforePause: 0 };
    case "PAUSE": return { ...state, status: "paused", pausedAt: new Date().toISOString() };
    case "RESUME": {
      const pauseMs = state.pausedAt ? Date.now() - new Date(state.pausedAt).getTime() : 0;
      return { ...state, status: "active", elapsedBeforePause: state.elapsedBeforePause + pauseMs, pausedAt: null };
    }
    case "GO_TO": return { ...state, currentQuestionIndex: action.index, viewedQuestionIds: [...new Set([...(state.viewedQuestionIds ?? []), action.questionId])], answerRevealed: false };
    case "REVEAL": return { ...state, answerRevealed: action.value };
    case "AWARD": return { ...state, questionResults: replaceQuestionAwards(state.questionResults, action.questionId, action.awards) };
    case "SKIP": {
      const skipped: QuestionResult = { questionId: action.questionId, awards: [], completed: true, skipped: true };
      return { ...state, questionResults: state.questionResults.some((r) => r.questionId === action.questionId) ? state.questionResults.map((r) => r.questionId === action.questionId ? skipped : r) : [...state.questionResults, skipped] };
    }
    case "ADJUST": return { ...state, adjustments: [...state.adjustments, action.adjustment] };
    case "UNDO_ADJUSTMENT": return { ...state, adjustments: state.adjustments.filter((a) => a.id !== action.adjustmentId) };
    case "FINISH": return { ...state, status: "finished" };
    case "RETURN_TO_SETUP": return { ...state, status: "setup", currentQuestionIndex: 0, answerRevealed: false };
    case "REMATCH": return { ...state, status: "active", currentQuestionIndex: 0, choiceOrder: action.choiceOrder, viewedQuestionIds: [action.firstQuestionId], questionResults: [], adjustments: [], answerRevealed: false, startedAt: new Date().toISOString(), elapsedBeforePause: 0, pausedAt: null };
    case "RESTORE": return action.session;
  }
}
