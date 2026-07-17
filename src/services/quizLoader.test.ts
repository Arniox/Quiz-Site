import { describe, expect, it, vi } from "vitest";
import { loadQuiz, loadQuizCatalog } from "./quizLoader";

const validQuiz = (title: string) => ({ title, description: "Description", questions: [{ id: "q1", question: "Question?", answerType: "single", answers: ["Answer"], points: 2, category: "Science" }] });
const fetcherFor = (files: Record<string, unknown>) => vi.fn(async (input: RequestInfo | URL) => {
  const key = String(input).split("/").pop() ?? "";
  return key in files ? new Response(JSON.stringify(files[key]), { status: 200 }) : new Response("Missing", { status: 404 });
}) as unknown as typeof fetch;

describe("quiz loading", () => {
  it("uses the title from quiz metadata", async () => {
    const loaded = await loadQuiz({ id: "opaque-id", file: "quiz.json" }, fetcherFor({ "quiz.json": validQuiz("Visible JSON Title") }));
    expect(loaded.title).toBe("Visible JSON Title"); expect(loaded.questionCount).toBe(1); expect(loaded.totalBasePoints).toBe(2);
  });
  it("loads multiple valid quiz files", async () => {
    const catalog = await loadQuizCatalog([{ id: "one", file: "one.json" }, { id: "two", file: "two.json" }], fetcherFor({ "one.json": validQuiz("One"), "two.json": validQuiz("Two") }));
    expect(catalog.map((item) => item.summary?.title)).toEqual(["One", "Two"]);
  });
  it("keeps a valid quiz available beside an invalid quiz", async () => {
    const catalog = await loadQuizCatalog([{ id: "good", file: "good.json" }, { id: "bad", file: "bad.json" }], fetcherFor({ "good.json": validQuiz("Good"), "bad.json": { title: "Broken", questions: [] } }));
    expect(catalog[0].summary?.title).toBe("Good"); expect(catalog[1].error).toMatch(/at least one/i);
  });
});
