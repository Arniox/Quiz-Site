import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateManifest } from "./services/quizManifestLoader";
import { validateQuiz } from "./services/quizValidation";

const quizDirectory = resolve(process.cwd(), "public", "quizzes");

describe("repository quiz data", () => {
  const manifest = validateManifest(JSON.parse(readFileSync(resolve(quizDirectory, "index.json"), "utf8")));

  it("lists unique quiz files that all exist and validate", () => {
    expect(new Set(manifest.quizzes.map((entry) => entry.id)).size).toBe(manifest.quizzes.length);
    manifest.quizzes.forEach((entry) => {
      const file = resolve(quizDirectory, entry.file);
      expect(existsSync(file)).toBe(true);
      expect(() => validateQuiz(JSON.parse(readFileSync(file, "utf8")))).not.toThrow();
    });
  });

  it("contains a complete Great Knowledge Challenge", () => {
    const quiz = validateQuiz(JSON.parse(readFileSync(resolve(quizDirectory, "great-knowledge-challenge.json"), "utf8")));
    expect(quiz.questions).toHaveLength(40);
    for (const category of ["Astronomy", "Science", "History", "Geography"]) expect(quiz.questions.filter((question) => question.category === category)).toHaveLength(10);
    expect(quiz.questions.filter((question) => question.answerType === "multiple")).toHaveLength(8);
    expect(quiz.questions.filter((question) => question.answerType === "open")).toHaveLength(0);
    expect(quiz.questions.filter((question) => question.choices)).toHaveLength(23);
    expect(new Set(quiz.questions.map((question) => question.id)).size).toBe(40);
    quiz.questions.forEach((question) => {
      expect(question.answers.length).toBeGreaterThan(0);
      expect(Number.isInteger(question.points)).toBe(true);
      expect(question.points).toBeGreaterThan(0);
      expect(question.category).toBeTruthy();
      expect(typeof question.notes).toBe("string");
    });
  });

  it("contains a friendly August 2026 quiz", () => {
    const quiz = validateQuiz(JSON.parse(readFileSync(resolve(quizDirectory, "august-2026-friday-quiz.json"), "utf8")));
    expect(quiz.questions).toHaveLength(40);
    for (const category of ["Movies & TV", "Pop Culture", "Geography", "World Politics"]) expect(quiz.questions.filter((question) => question.category === category)).toHaveLength(10);
    expect(quiz.questions.filter((question) => question.choices)).toHaveLength(33);
    expect(new Set(quiz.questions.map((question) => question.id)).size).toBe(40);
    quiz.questions.forEach((question) => {
      expect(question.answers.length).toBeGreaterThan(0);
      expect(Number.isInteger(question.points)).toBe(true);
      expect(question.points).toBeGreaterThan(0);
      expect(question.category).toBeTruthy();
      expect(typeof question.notes).toBe("string");
    });
  });
});
