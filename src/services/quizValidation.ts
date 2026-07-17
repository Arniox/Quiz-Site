import type { QuizFile } from "../models";

export function validateQuiz(data: unknown): QuizFile {
  if (!data || typeof data !== "object") throw new Error("The root of the file must be a JSON object.");
  const value = data as Record<string, unknown>;
  if (typeof value.title !== "string" || !value.title.trim()) throw new Error("Field ‘title’ is required and must not be blank.");
  if (!Array.isArray(value.questions) || value.questions.length === 0) throw new Error("Field ‘questions’ must contain at least one question.");
  const ids = new Set<string>();
  const questions = value.questions.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`Question ${index + 1} must be an object.`);
    const q = raw as Record<string, unknown>;
    const label = `Question ${index + 1}`;
    if (typeof q.id !== "string" || !q.id.trim()) throw new Error(`${label}: field ‘id’ is required.`);
    if (ids.has(q.id)) throw new Error(`${label}: duplicate id ‘${q.id}’.`);
    ids.add(q.id);
    if (typeof q.question !== "string" || !q.question.trim()) throw new Error(`${label} (${q.id}): field ‘question’ is required.`);
    if (!(["single", "multiple", "open"] as unknown[]).includes(q.answerType)) throw new Error(`${label} (${q.id}): answerType must be single, multiple, or open.`);
    if (!Number.isFinite(q.points) || (q.points as number) < 0) throw new Error(`${label} (${q.id}): points must be a non-negative number.`);
    if (!Array.isArray(q.answers) || !q.answers.every((answer) => typeof answer === "string")) throw new Error(`${label} (${q.id}): answers must be an array of text values.`);
    if (q.answerType === "single" && q.answers.length === 0) throw new Error(`${label} (${q.id}): a single-answer question needs at least one answer.`);
    return q as unknown as QuizFile["questions"][number];
  });
  return {
    title: value.title.trim(),
    description: typeof value.description === "string" ? value.description : undefined,
    settings: value.settings as QuizFile["settings"],
    questions
  };
}
