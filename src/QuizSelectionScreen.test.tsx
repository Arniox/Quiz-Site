import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuizSelectionScreen } from "./App";
import type { QuizCatalogItem } from "./models";

const quiz = { title: "Metadata Title", description: "A quiz", questions: [{ id: "q1", question: "Question?", answerType: "single" as const, answers: ["Answer"], points: 1, category: "Science" }] };
const items: QuizCatalogItem[] = [{ id: "quiz", file: "machine-name.json", summary: { id: "quiz", file: "machine-name.json", title: quiz.title, description: quiz.description, questionCount: 1, totalBasePoints: 1, categories: ["Science"], quiz } }];

describe("quiz selection screen", () => {
  it("prevents continuation until a quiz is selected", () => {
    const onContinue = vi.fn(); render(<QuizSelectionScreen items={items} loading={false} onContinue={onContinue} onRetry={() => undefined}/>);
    const continueButton = screen.getByRole("button", { name: /continue to setup/i }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /metadata title/i }));
    expect(continueButton.disabled).toBe(false); fireEvent.click(continueButton); expect(onContinue).toHaveBeenCalledOnce();
  });
});
