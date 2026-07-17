import { describe, expect, it, vi } from "vitest";
import { isSafeQuizPath, loadQuizManifest, validateManifest } from "./quizManifestLoader";

const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

describe("quiz manifest validation", () => {
  it("loads a valid manifest", async () => {
    const fetcher = vi.fn(async () => response({ quizzes: [{ id: "one", file: "one.json" }] })) as unknown as typeof fetch;
    await expect(loadQuizManifest(fetcher)).resolves.toEqual({ quizzes: [{ id: "one", file: "one.json" }] });
  });
  it("rejects an invalid structure", () => expect(() => validateManifest({ items: [] })).toThrow(/quizzes/i));
  it("rejects duplicate IDs", () => expect(() => validateManifest({ quizzes: [{ id: "one", file: "one.json" }, { id: "one", file: "two.json" }] })).toThrow(/duplicate/i));
  it("rejects missing filenames", () => expect(() => validateManifest({ quizzes: [{ id: "one" }] })).toThrow(/filename/i));
  it.each(["../questions.json", "https://example.com/quiz.json", "C:\\quiz.json", "/quizzes/private.json"])("rejects unsafe path %s", (file) => expect(isSafeQuizPath(file)).toBe(false));
  it.each(["quiz.json", "science/advanced-science.json"])("accepts safe path %s", (file) => expect(isSafeQuizPath(file)).toBe(true));
});
