export type GameStatus = "setup" | "active" | "paused" | "finished";
export type QuizMode = "individual" | "teams";
export type AnswerType = "single" | "multiple" | "open";

export interface QuizSettings {
  shuffleQuestions?: boolean;
  defaultFirstPlacePoints?: number;
  defaultSecondPlacePoints?: number;
  defaultThirdPlacePoints?: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  answerType: AnswerType;
  answers: string[];
  points: number;
  category?: string;
  notes?: string;
}

export interface QuizFile {
  title: string;
  description?: string;
  settings?: QuizSettings;
  questions: QuizQuestion[];
}

export interface QuizManifestEntry { id: string; file: string; }
export interface QuizManifest { quizzes: QuizManifestEntry[]; }
export interface LoadedQuizSummary {
  id: string;
  file: string;
  title: string;
  description?: string;
  questionCount: number;
  totalBasePoints: number;
  categories: string[];
  quiz: QuizFile;
}
export interface QuizCatalogItem { id: string; file: string; summary?: LoadedQuizSummary; error?: string; }
export interface SelectedQuizReference { quizId: string; quizFile: string; quizFingerprint: string; }

export interface Player { id: string; name: string; teamId: string | null; }
export interface Team { id: string; name: string; playerIds: string[]; }
export interface ScoreAward { participantId: string; points: number; }
export interface QuestionResult { questionId: string; awards: ScoreAward[]; completed: boolean; skipped: boolean; }
export interface ManualScoreAdjustment { id: string; participantId: string; points: number; reason?: string; createdAt: string; }

export interface GameSession {
  version: 1;
  fingerprint: string;
  selectedQuiz: SelectedQuizReference | null;
  status: GameStatus;
  mode: QuizMode;
  players: Player[];
  teams: Team[];
  currentQuestionIndex: number;
  questionResults: QuestionResult[];
  adjustments: ManualScoreAdjustment[];
  answerRevealed: boolean;
  startedAt: string | null;
  elapsedBeforePause: number;
  pausedAt: string | null;
}

export interface RankedParticipant { id: string; name: string; score: number; rank: number; order: number; members?: string[]; }
