import type { GameSession, ManualScoreAdjustment, QuestionResult, QuizFile, RankedParticipant, ScoreAward } from "./models";
export { validateQuiz } from "./services/quizValidation";

export const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export const roundScore = (value: number) => Math.round(value * 100) / 100;

export function quizFingerprint(quiz: QuizFile): string {
  return `${quiz.title}|${quiz.questions.length}|${quiz.questions.map((q) => q.id).join("|")}`;
}

export function replaceQuestionAwards(results: QuestionResult[], questionId: string, awards: ScoreAward[]): QuestionResult[] {
  const unique = new Map<string, number>();
  awards.forEach((award) => {
    if (Number.isFinite(award.points) && award.points !== 0) unique.set(award.participantId, roundScore(award.points));
  });
  const next = { questionId, awards: [...unique].map(([participantId, points]) => ({ participantId, points })), completed: true, skipped: false };
  const exists = results.some((result) => result.questionId === questionId);
  return exists ? results.map((result) => result.questionId === questionId ? next : result) : [...results, next];
}

export function calculateParticipantScore(participantId: string, results: QuestionResult[], adjustments: ManualScoreAdjustment[]): number {
  const awards = results.flatMap((result) => result.awards).filter((award) => award.participantId === participantId).reduce((sum, award) => sum + award.points, 0);
  const manual = adjustments.filter((adjustment) => adjustment.participantId === participantId).reduce((sum, adjustment) => sum + adjustment.points, 0);
  return roundScore(awards + manual);
}

export function calculateRankings(participants: { id: string; name: string; order: number; members?: string[] }[], results: QuestionResult[], adjustments: ManualScoreAdjustment[]): RankedParticipant[] {
  const sorted = participants.map((participant) => ({ ...participant, score: calculateParticipantScore(participant.id, results, adjustments) }))
    .sort((a, b) => b.score - a.score || a.order - b.order || a.name.localeCompare(b.name));
  return sorted.map((participant, index) => ({
    ...participant,
    rank: index > 0 && sorted[index - 1].score === participant.score
      ? sorted.findIndex((candidate) => candidate.score === participant.score) + 1
      : index + 1
  }));
}

export function saveSession(session: GameSession): void {
  localStorage.setItem("local-quiz-host.session.v1", JSON.stringify(session));
}

export function loadSession(): GameSession | null {
  const raw = localStorage.getItem("local-quiz-host.session.v1");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GameSession;
    return parsed.version === 1 ? parsed : null;
  } catch { return null; }
}

export function validateStart(session: GameSession): string[] {
  const errors: string[] = [];
  if (!session.players.length) errors.push("Add at least one player.");
  if (session.players.some((player) => !player.name.trim())) errors.push("Every player needs a name.");
  const playerNames = session.players.map((player) => player.name.trim().toLocaleLowerCase());
  if (new Set(playerNames).size !== playerNames.length) errors.push("Player names must be unique.");
  if (session.mode === "teams") {
    if (!session.teams.length) errors.push("Create at least one team.");
    if (session.teams.some((team) => !team.name.trim())) errors.push("Every team needs a name.");
    const teamNames = session.teams.map((team) => team.name.trim().toLocaleLowerCase());
    if (new Set(teamNames).size !== teamNames.length) errors.push("Team names must be unique.");
    session.teams.filter((team) => team.playerIds.length === 0).forEach((team) => errors.push(`${team.name} has no members.`));
    const unassigned = session.players.filter((player) => !player.teamId);
    if (unassigned.length) errors.push(`Assign every player to a team (${unassigned.length} unassigned).`);
  }
  return errors;
}
