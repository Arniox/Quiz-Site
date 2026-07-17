import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { GameSession, LoadedQuizSummary, QuizCatalogItem, QuizFile, RankedParticipant, ScoreAward, SelectedQuizReference } from "./models";
import { createSession, gameReducer } from "./game";
import { calculateRankings, createId, getQuestionProgressStatus, loadSession, quizFingerprint, saveSession, shuffleQuestionChoices, validateStart } from "./utils";
import { loadQuizCatalog } from "./services/quizLoader";
import { loadQuizManifest } from "./services/quizManifestLoader";
import { resolveSavedQuiz } from "./services/sessionCompatibility";

const STORAGE_KEY = "local-quiz-host.session.v1";

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { ref.current?.focus(); const close = (event: KeyboardEvent) => event.key === "Escape" && onClose(); document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [onClose]);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-title"><h2 id="dialog-title">{title}</h2><button ref={ref} className="icon-btn" onClick={onClose} aria-label="Close dialog">×</button></div>{children}</section></div>;
}

function LoadingState() { return <main className="center-state"><div className="brand-mark">Q</div><h1>Preparing your quiz room…</h1></main>; }
function ErrorState({ error, retry }: { error: string; retry: () => void }) { return <main className="center-state error-card"><span className="eyebrow danger-text">Quiz library problem</span><h1>We couldn’t load the quiz library</h1><p>{error}</p><code>public/quizzes/index.json</code><button className="primary" onClick={retry}>Try loading again</button></main>; }

export function QuizSelectionScreen({ items, loading, onContinue, onRetry }: { items: QuizCatalogItem[]; loading: boolean; onContinue: (quiz: LoadedQuizSummary) => void; onRetry: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId)?.summary;
  return <main className="selection-shell"><header className="selection-hero"><div className="brand-mark">Q</div><span className="eyebrow">Quizmaster Local</span><h1>Choose tonight’s challenge</h1><p>Select a quiz, then configure the players or teams. Only the host interacts with this screen.</p></header>
    {loading ? <div className="library-loading" role="status">Loading your local quiz library…</div> : <section className="quiz-library" aria-label="Available quizzes">{items.map((item) => item.summary ? <button type="button" key={item.id} className={`quiz-card ${selectedId === item.id ? "selected" : ""}`} aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)}><div className="quiz-card-top"><span className="file-status ready">Ready</span><span>{item.summary.questionCount} questions</span></div><h2>{item.summary.title}</h2><p>{item.summary.description ?? "No description provided."}</p><div className="category-list">{item.summary.categories.map((category) => <span key={category}>{category}</span>)}</div><div className="quiz-card-footer"><strong>{item.summary.totalBasePoints}</strong><span>available base points</span></div></button> : <article className="quiz-card invalid" key={item.id}><div className="quiz-card-top"><span className="file-status failed">Unavailable</span><span>{item.file}</span></div><h2>{item.file}</h2><p>{item.error}</p></article>)}</section>}
    {!loading && <div className="selection-actions"><button onClick={onRetry}>Reload library</button><button className="launch" disabled={!selected} onClick={() => selected && onContinue(selected)}>Continue to setup <span>→</span></button></div>}
  </main>;
}

function SetupScreen({ quiz, session, dispatch, reset, back }: { quiz: QuizFile; session: GameSession; dispatch: React.Dispatch<Parameters<typeof gameReducer>[1]>; reset: () => void; back: () => void }) {
  const [playerName, setPlayerName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [message, setMessage] = useState("");
  const errors = validateStart(session);
  const addPlayer = () => {
    const name = playerName.trim();
    if (!name) return setMessage("Enter a player name first.");
    if (session.players.some((p) => p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return setMessage("That player name is already in use.");
    dispatch({ type: "ADD_PLAYER", name }); setPlayerName(""); setMessage("");
  };
  const addTeam = () => {
    const name = teamName.trim(); if (!name) return setMessage("Enter a team name first.");
    if (session.teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) return setMessage("That team name is already in use.");
    dispatch({ type: "ADD_TEAM", name }); setTeamName(""); setMessage("");
  };
  return <main className="setup-shell">
    <header className="setup-hero">
      <div><button className="text-button back-button" onClick={back}>← Choose another quiz</button><span className="eyebrow">Local quiz control</span><h1>{quiz.title}</h1><p>{quiz.description}</p></div>
      <div className="quiz-stats"><strong>{quiz.questions.length}</strong><span>questions</span><strong>{quiz.questions.reduce((sum, q) => sum + q.points, 0)}</strong><span>base points</span></div>
    </header>
    <section className="setup-grid">
      <div className="panel roster-panel"><div className="panel-heading"><div><span className="step">01</span><h2>Build the roster</h2></div><span className="count-badge">{session.players.length} players</span></div>
        <form className="add-row" onSubmit={(e) => { e.preventDefault(); addPlayer(); }}><label className="sr-only" htmlFor="player-name">Player name</label><input id="player-name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Enter a player name" maxLength={60}/><button className="primary" type="submit">Add player</button></form>
        {message && <p className="form-message" role="alert">{message}</p>}
        <div className="roster-list">{session.players.length === 0 ? <div className="empty"><strong>Your stage is empty</strong><span>Add the first player to get started.</span></div> : session.players.map((player, index) => <div className="roster-row" key={player.id}><span className="drag-number">{String(index + 1).padStart(2, "0")}</span><input aria-label={`Name for ${player.name}`} value={player.name} onChange={(e) => dispatch({ type: "UPDATE_PLAYER", playerId: player.id, name: e.target.value })}/><div className="row-actions"><button aria-label={`Move ${player.name} up`} disabled={index === 0} onClick={() => dispatch({ type: "MOVE_PLAYER", playerId: player.id, direction: -1 })}>↑</button><button aria-label={`Move ${player.name} down`} disabled={index === session.players.length - 1} onClick={() => dispatch({ type: "MOVE_PLAYER", playerId: player.id, direction: 1 })}>↓</button><button className="danger-ghost" aria-label={`Remove ${player.name}`} onClick={() => dispatch({ type: "REMOVE_PLAYER", playerId: player.id })}>×</button></div></div>)}</div>
      </div>
      <div className="panel mode-panel"><div className="panel-heading"><div><span className="step">02</span><h2>Choose the format</h2></div></div>
        <div className="mode-switch" role="radiogroup" aria-label="Quiz mode"><button className={session.mode === "individual" ? "selected" : ""} role="radio" aria-checked={session.mode === "individual"} onClick={() => dispatch({ type: "SET_MODE", mode: "individual" })}><strong>Solo</strong><span>Every player for themselves</span></button><button className={session.mode === "teams" ? "selected" : ""} role="radio" aria-checked={session.mode === "teams"} onClick={() => dispatch({ type: "SET_MODE", mode: "teams" })}><strong>Teams</strong><span>Win together, score together</span></button></div>
        {session.mode === "teams" && <div className="team-builder"><form className="add-row compact" onSubmit={(e) => { e.preventDefault(); addTeam(); }}><label className="sr-only" htmlFor="team-name">Team name</label><input id="team-name" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="New team name"/><button type="submit">Add team</button></form>
          {session.teams.length > 1 && <button className="text-button" onClick={() => dispatch({ type: "AUTO_DISTRIBUTE" })}>Distribute players evenly</button>}
          <div className="team-list">{session.teams.map((team) => <div className="team-card" key={team.id}><div className="team-card-title"><input aria-label="Team name" value={team.name} onChange={(e) => dispatch({ type: "UPDATE_TEAM", teamId: team.id, name: e.target.value })}/><button className="danger-ghost" onClick={() => dispatch({ type: "REMOVE_TEAM", teamId: team.id })}>Delete</button></div>{session.players.map((player) => <label className="member-select" key={player.id}><span>{player.name}</span><select value={player.teamId ?? ""} onChange={(e) => dispatch({ type: "ASSIGN_PLAYER", playerId: player.id, teamId: e.target.value || null })}><option value="">Unassigned</option>{session.teams.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>)}</div>)}</div>
        </div>}
        <div className="launch-card"><div><span className="eyebrow">Ready check</span><strong>{errors.length ? `${errors.length} thing${errors.length === 1 ? "" : "s"} to fix` : "Everything looks good"}</strong></div>{errors.length > 0 && <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>}<button className="launch" disabled={errors.length > 0} onClick={() => dispatch({ type: "START", choiceOrder: shuffleQuestionChoices(quiz), firstQuestionId: quiz.questions[0].id })}>Start the quiz <span>→</span></button><button className="text-button" onClick={reset}>Clear saved setup</button></div>
      </div>
    </section>
  </main>;
}

function Scoreboard({ rankings, session, dispatch, questionId, basePoints, initialAwards, onHistory, onDraftChange, onNoCorrect }: { rankings: RankedParticipant[]; session: GameSession; dispatch: React.Dispatch<Parameters<typeof gameReducer>[1]>; questionId: string; basePoints: number; initialAwards: ScoreAward[]; onHistory: (id: string) => void; onDraftChange: (awards: ScoreAward[]) => void; onNoCorrect: () => void }) {
  const existing = session.questionResults.find((result) => result.questionId === questionId)?.awards ?? [];
  const [selected, setSelected] = useState<Record<string, boolean>>(() => Object.fromEntries(initialAwards.map((award) => [award.participantId, true])));
  const [amounts, setAmounts] = useState<Record<string, string>>(() => Object.fromEntries(initialAwards.map((award) => [award.participantId, String(award.points)])));
  const adjust = (id: string, points: number, reason: string) => dispatch({ type: "ADJUST", adjustment: { id: createId("adjustment"), participantId: id, points, reason, createdAt: new Date().toISOString() } });
  const buildAwards = (nextSelected: Record<string, boolean>, nextAmounts: Record<string, string>) => rankings.filter((participant) => nextSelected[participant.id]).map((participant) => ({ participantId: participant.id, points: Number(nextAmounts[participant.id] ?? basePoints) })).filter((award) => Number.isFinite(award.points) && award.points !== 0);
  const updateSelection = (participantId: string, checked: boolean) => {
    const nextSelected = { ...selected, [participantId]: checked };
    const nextAmounts = amounts[participantId] === undefined && checked ? { ...amounts, [participantId]: String(basePoints) } : amounts;
    setSelected(nextSelected); setAmounts(nextAmounts); onDraftChange(buildAwards(nextSelected, nextAmounts));
  };
  const updateAmount = (participantId: string, value: string) => {
    const nextAmounts = { ...amounts, [participantId]: value };
    setAmounts(nextAmounts); onDraftChange(buildAwards(selected, nextAmounts));
  };
  const draftAwards = buildAwards(selected, amounts);
  const apply = () => dispatch({ type: "AWARD", questionId, awards: draftAwards });
  const noCorrect = () => { setSelected({}); onDraftChange([]); onNoCorrect(); };
  return <aside className="score-panel"><div className="score-heading"><div><span className="eyebrow">Live standings</span><h2>Scoreboard</h2></div><span className="live-dot">Live</span></div><div className="score-list">{rankings.map((participant) => <div className={`score-row ${participant.rank === 1 ? "leader" : ""} ${existing.some((award) => award.participantId === participant.id) ? "awarded" : ""}`} key={participant.id}><div className="rank">{participant.rank}</div><div className="participant"><button className="participant-name" onClick={() => onHistory(participant.id)}>{participant.name}</button>{participant.members && <small>{participant.members.join(" · ")}</small>}</div><strong className="score">{participant.score}</strong><div className="quick-score" title="Manual total correction — not part of this question"><button aria-label={`Manually remove one point from ${participant.name}'s total`} onClick={() => adjust(participant.id, -1, "Manual total correction −1")}>−</button><button aria-label={`Manually add one point to ${participant.name}'s total`} onClick={() => adjust(participant.id, 1, "Manual total correction +1")}>+</button></div><label className="award-toggle"><input type="checkbox" checked={!!selected[participant.id]} onChange={(event) => updateSelection(participant.id, event.target.checked)}/><span>Award</span></label><input className="points-input" aria-label={`Points for ${participant.name}`} type="number" step="0.5" value={amounts[participant.id] ?? basePoints} onChange={(event) => updateAmount(participant.id, event.target.value)}/></div>)}</div><div className="score-submit-actions"><button className="apply-awards" disabled={!draftAwards.length} onClick={apply}>Apply selected points</button><button className="no-correct" onClick={noCorrect}>No one answered correctly</button></div><p className="score-hint">Next also saves the current selections. Everyone else receives zero. ± changes are total-score corrections only.</p></aside>;
}

function QuizScreen({ quiz, session, dispatch, rankings, onEnd, onHistory }: { quiz: QuizFile; session: GameSession; dispatch: React.Dispatch<Parameters<typeof gameReducer>[1]>; rankings: RankedParticipant[]; onEnd: () => void; onHistory: (id: string) => void }) {
  const question = quiz.questions[session.currentQuestionIndex];
  const result = session.questionResults.find((r) => r.questionId === question.id);
  const isLast = session.currentQuestionIndex === quiz.questions.length - 1;
  const [navigator, setNavigator] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, ScoreAward[]>>({});
  const displayedChoices = session.choiceOrder?.[question.id] ?? question.choices;
  const currentDraft = drafts[question.id] ?? result?.awards ?? [];
  const goTo = (index: number) => dispatch({ type: "GO_TO", index, questionId: quiz.questions[index].id });
  const advance = () => isLast ? setNavigator(true) : goTo(session.currentQuestionIndex + 1);
  const commitAndAdvance = () => { dispatch({ type: "AWARD", questionId: question.id, awards: currentDraft }); advance(); };
  const skipAndAdvance = () => { dispatch({ type: "SKIP", questionId: question.id }); setDrafts((current) => ({ ...current, [question.id]: [] })); advance(); };
  const markNoCorrect = () => { dispatch({ type: "AWARD", questionId: question.id, awards: [] }); setDrafts((current) => ({ ...current, [question.id]: [] })); };
  return <main className="quiz-shell"><header className="quiz-header"><div className="quiz-brand"><span className="brand-mark small">Q</span><div><strong>{quiz.title}</strong><span>{session.status === "paused" ? "Paused" : "Host control"}</span></div></div><div className="progress-block"><div><span>Question {session.currentQuestionIndex + 1} of {quiz.questions.length}</span><span>{Math.round(((session.currentQuestionIndex + 1) / quiz.questions.length) * 100)}%</span></div><div className="progress"><span style={{ width: `${((session.currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}/></div></div><div className="header-actions"><button onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()}>Fullscreen</button><button onClick={() => dispatch({ type: session.status === "paused" ? "RESUME" : "PAUSE" })}>{session.status === "paused" ? "Resume" : "Pause"}</button><button className="danger" onClick={onEnd}>End quiz</button></div></header>
    <div className={`quiz-grid ${session.status === "paused" ? "is-paused" : ""}`}><section className="question-stage"><div className="question-meta"><span className="category">{question.category ?? "General"}</span><span>{question.points} {question.points === 1 ? "point" : "points"}</span>{question.choices && <span className="choice-badge">Multiple choice</span>}</div><p className="question-kicker">Question {String(session.currentQuestionIndex + 1).padStart(2, "0")}</p><h1>{question.question}</h1>
      {displayedChoices && <section className="choice-panel" aria-label="Possible answers"><div className="choice-instruction">{question.answerType === "multiple" ? `Choose ${question.answers.length}` : "Choose one"}</div><div className="choice-grid">{displayedChoices.map((choice, index) => { const correct = session.answerRevealed && question.answers.some((answer) => answer.trim().toLocaleLowerCase() === choice.trim().toLocaleLowerCase()); return <div className={`choice-option ${correct ? "correct" : ""}`} key={choice}><span>{String.fromCharCode(65 + index)}</span><strong>{choice}</strong>{correct && <em>Correct</em>}</div>; })}</div></section>}
      <div className={`answer-panel ${session.answerRevealed ? "revealed" : ""}`}>{session.answerRevealed ? <><span className="eyebrow">Answer</span>{question.answerType === "open" ? <h2>Host decision — no fixed answer</h2> : question.answerType === "multiple" ? <div className="answer-chips">{question.answers.map((answer) => <span key={answer}>{answer}</span>)}</div> : <h2>{question.answers[0]}</h2>}</> : <><span className="answer-icon">?</span><div><strong>Answer hidden</strong><small>Press Space or use the button below</small></div></>}</div>
      {question.notes && <details className="host-notes"><summary>Host notes</summary><p>{question.notes}</p></details>}
      <div className="question-actions"><button disabled={session.currentQuestionIndex === 0} onClick={() => goTo(session.currentQuestionIndex - 1)}>← Previous</button><button className="reveal" onClick={() => dispatch({ type: "REVEAL", value: !session.answerRevealed })}>{session.answerRevealed ? "Hide answer" : "Show answer"}</button><button className="next-question" onClick={commitAndAdvance}>{isLast ? "Save & review" : "Next →"}</button><button className="skip-question" onClick={skipAndAdvance}>Skip</button></div><div className="secondary-actions"><span>{result?.skipped ? "This question was skipped." : result?.awards.length ? "Points saved for this question." : result?.completed ? "Completed with no correct answers." : "Next saves the current point selections."}</span><button className="text-button" onClick={() => setNavigator(true)}>Question navigator</button></div></section>
      <Scoreboard key={question.id} rankings={rankings} session={session} dispatch={dispatch} questionId={question.id} basePoints={question.points} initialAwards={currentDraft} onHistory={onHistory} onDraftChange={(awards) => setDrafts((current) => ({ ...current, [question.id]: awards }))} onNoCorrect={markNoCorrect}/></div>
    {session.status === "paused" && <div className="paused-overlay"><div className="pause-icon">Ⅱ</div><span className="eyebrow">Game paused</span><h2>Take a breather</h2><p>The question is hidden and your progress is safe.</p><button className="primary" onClick={() => dispatch({ type: "RESUME" })}>Resume quiz</button></div>}
    {navigator && <Dialog title="Question review" onClose={() => setNavigator(false)}><div className="review-summary"><strong>{session.questionResults.filter((item) => item.completed).length} / {quiz.questions.length}</strong><span>questions completed</span></div><div className="navigator-grid">{quiz.questions.map((item, index) => { const state = getQuestionProgressStatus(item.id, session.questionResults, session.viewedQuestionIds ?? []); const current = index === session.currentQuestionIndex; return <button className={`${state} ${current ? "current" : ""}`} key={item.id} onClick={() => { goTo(index); setNavigator(false); }}><strong>{index + 1}</strong><span>{current ? `current · ${state.replace("-", " ")}` : state.replace("-", " ")}</span></button>; })}</div><div className="dialog-actions"><button onClick={() => setNavigator(false)}>Keep playing</button><button className="danger" onClick={onEnd}>Finish quiz</button></div></Dialog>}
  </main>;
}

function ResultsScreen({ quiz, session, rankings, dispatch, reset }: { quiz: QuizFile; session: GameSession; rankings: RankedParticipant[]; dispatch: React.Dispatch<Parameters<typeof gameReducer>[1]>; reset: () => void }) {
  const exportResults = () => {
    const data = { quizTitle: quiz.title, exportedAt: new Date().toISOString(), mode: session.mode, players: session.players, teams: session.teams, finalRankings: rankings, questionResults: session.questionResults, manualAdjustments: session.adjustments };
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); link.download = `${quiz.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-results.json`; link.click(); URL.revokeObjectURL(link.href);
  };
  const winners = rankings.filter((r) => r.rank === 1);
  const highest = Math.max(0, ...session.questionResults.flatMap((r) => r.awards.map((a) => a.points)));
  return <main className="results-shell"><header className="results-hero"><span className="eyebrow">Final results</span><h1>{winners.length > 1 ? "We have a tie!" : `${winners[0]?.name ?? "Quiz"} takes the win!`}</h1><p>{winners.length > 1 ? `${winners.map((w) => w.name).join(" and ")} share first place on ${winners[0]?.score} points.` : `${quiz.title} is in the books. What a game.`}</p></header><section className="results-grid"><div className="panel podium-panel"><div className="podium">{rankings.filter((r) => r.rank <= 3).map((r) => <div className={`podium-place place-${r.rank}`} key={r.id}><span className="medal">{r.rank === 1 ? "★" : r.rank}</span><strong>{r.name}</strong><span>{r.score} pts</span></div>)}</div><div className="stat-strip"><div><strong>{session.questionResults.filter((r) => r.completed).length}</strong><span>played</span></div><div><strong>{session.questionResults.filter((r) => r.skipped).length}</strong><span>skipped</span></div><div><strong>{highest}</strong><span>top award</span></div></div></div><div className="panel final-table"><h2>Final standings</h2>{rankings.map((r) => <div className="final-row" key={r.id}><span className="rank">{r.rank}</span><div><strong>{r.name}</strong>{r.members && <small>{r.members.join(" · ")}</small>}</div><strong>{r.score}</strong></div>)}</div></section><div className="results-actions"><button className="primary" onClick={() => dispatch({ type: "REMATCH", choiceOrder: shuffleQuestionChoices(quiz), firstQuestionId: quiz.questions[0].id })}>Start rematch</button><button onClick={() => dispatch({ type: "RETURN_TO_SETUP" })}>Return to setup</button><button onClick={exportResults}>Export JSON</button><button onClick={() => window.print()}>Print results</button><button className="danger" onClick={reset}>Full reset</button></div></main>;
}

export default function App() {
  const [quiz, setQuiz] = useState<QuizFile | null>(null);
  const [catalog, setCatalog] = useState<QuizCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadNonce, setLoadNonce] = useState(0);
  const [restoreCandidate, setRestoreCandidate] = useState<GameSession | null>(null);
  const [restoreUnavailable, setRestoreUnavailable] = useState("");
  const [session, dispatch] = useReducer(gameReducer, createSession(null));
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadQuizManifest().then((manifest) => loadQuizCatalog(manifest.quizzes)).then((items) => {
      if (cancelled) return;
      setCatalog(items); setLoadError(""); setCatalogLoading(false);
      const saved = loadSession();
      if (!saved) return;
      const resolution = resolveSavedQuiz(saved, items);
      setRestoreCandidate(saved);
      if (resolution.error || !resolution.summary) { setRestoreUnavailable(resolution.error ?? "The saved quiz is unavailable."); return; }
      setQuiz(resolution.summary.quiz);
    }).catch((error: unknown) => { if (!cancelled) { setLoadError(error instanceof Error ? error.message : "An unknown error occurred."); setCatalogLoading(false); } });
    return () => { cancelled = true; };
  }, [loadNonce]);
  useEffect(() => { if (quiz && !restoreCandidate) saveSession(session); }, [session, quiz, restoreCandidate]);
  const participants = useMemo(() => session.mode === "individual" ? session.players.map((p, order) => ({ id: p.id, name: p.name, order })) : session.teams.map((t, order) => ({ id: t.id, name: t.name, order, members: t.playerIds.map((id) => session.players.find((p) => p.id === id)?.name).filter((name): name is string => !!name) })), [session.mode, session.players, session.teams]);
  const rankings = useMemo(() => calculateRankings(participants, session.questionResults, session.adjustments), [participants, session.questionResults, session.adjustments]);
  const reset = useCallback(() => setConfirmReset(true), []);
  const selectQuiz = (selected: LoadedQuizSummary) => {
    const reference: SelectedQuizReference = { quizId: selected.id, quizFile: selected.file, quizFingerprint: quizFingerprint(selected.quiz) };
    const next = createSession(reference);
    dispatch({ type: "RESTORE", session: { ...next, players: session.players, teams: session.teams, mode: session.mode } });
    setQuiz(selected.quiz);
  };
  const doReset = () => { localStorage.removeItem(STORAGE_KEY); dispatch({ type: "RESTORE", session: createSession(null) }); setQuiz(null); setRestoreCandidate(null); setRestoreUnavailable(""); setConfirmReset(false); };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { const target = event.target as HTMLElement; if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || !quiz || !["active", "paused"].includes(session.status)) return; if (event.code === "Space") { event.preventDefault(); dispatch({ type: "REVEAL", value: !session.answerRevealed }); } if (event.key.toLowerCase() === "p") dispatch({ type: session.status === "paused" ? "RESUME" : "PAUSE" }); if (event.key.toLowerCase() === "f") { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen(); } };
    document.addEventListener("keydown", handler); return () => document.removeEventListener("keydown", handler);
  }, [quiz, session.status, session.answerRevealed]);
  if (loadError) return <ErrorState error={loadError} retry={() => { setCatalogLoading(true); setLoadNonce((n) => n + 1); }}/>;
  if (catalogLoading && !catalog.length) return <LoadingState/>;
  const fingerprintMatches = !!quiz && restoreCandidate?.selectedQuiz?.quizFingerprint === quizFingerprint(quiz);
  return <><div className="ambient ambient-one"/><div className="ambient ambient-two"/><div aria-live="polite" className="sr-only">{rankings[0] ? `Standings updated. ${rankings[0].name} is currently leading.` : "Quiz library ready."}</div>{!quiz && <QuizSelectionScreen items={catalog} loading={catalogLoading} onContinue={selectQuiz} onRetry={() => { setCatalogLoading(true); setLoadNonce((n) => n + 1); }}/>} {quiz && session.status === "setup" && <SetupScreen quiz={quiz} session={session} dispatch={dispatch} reset={reset} back={() => setQuiz(null)}/>} {quiz && (session.status === "active" || session.status === "paused") && <QuizScreen quiz={quiz} session={session} dispatch={dispatch} rankings={rankings} onEnd={() => setConfirmEnd(true)} onHistory={setHistoryId}/>} {quiz && session.status === "finished" && <ResultsScreen quiz={quiz} session={session} dispatch={dispatch} rankings={rankings} reset={reset}/>} 
    {restoreCandidate && <Dialog title={restoreUnavailable ? "Saved quiz unavailable" : "Continue your saved quiz?"} onClose={() => { setRestoreCandidate(null); setRestoreUnavailable(""); setQuiz(null); localStorage.removeItem(STORAGE_KEY); }}><p>{restoreUnavailable || "We found progress saved in this browser for this quiz."}</p>{!restoreUnavailable && !fingerprintMatches && <p className="warning-box">The quiz file has changed since this session was saved. Starting fresh is recommended.</p>}<div className="dialog-actions"><button onClick={() => { setRestoreCandidate(null); setRestoreUnavailable(""); setQuiz(null); localStorage.removeItem(STORAGE_KEY); }}>Discard progress</button>{!restoreUnavailable && <button className="primary" disabled={!fingerprintMatches} onClick={() => { dispatch({ type: "RESTORE", session: restoreCandidate }); setRestoreCandidate(null); }}>Resume quiz</button>}</div></Dialog>}
    {confirmEnd && <Dialog title="End the quiz?" onClose={() => setConfirmEnd(false)}><p>This moves the game to final results. Scores are preserved, and you can start a rematch later.</p><div className="dialog-actions"><button onClick={() => setConfirmEnd(false)}>Keep playing</button><button className="danger" onClick={() => { dispatch({ type: "FINISH" }); setConfirmEnd(false); }}>End and show results</button></div></Dialog>}
    {confirmReset && <Dialog title="Delete all local progress?" onClose={() => setConfirmReset(false)}><p>This removes the roster, teams, scores, and saved session from this browser. It cannot be undone.</p><div className="dialog-actions"><button onClick={() => setConfirmReset(false)}>Cancel</button><button className="danger" onClick={doReset}>Delete everything</button></div></Dialog>}
    {historyId && <Dialog title="Score history" onClose={() => setHistoryId(null)}>{(() => { const participant = rankings.find((p) => p.id === historyId); const awards = session.questionResults.flatMap((r) => r.awards.filter((a) => a.participantId === historyId).map((a) => ({ ...a, questionId: r.questionId }))); const adjustments = session.adjustments.filter((a) => a.participantId === historyId); return <><div className="history-total"><span>{participant?.name}</span><strong>{participant?.score} points</strong></div><div className="history-list">{awards.map((a) => <div key={a.questionId}><span>{quiz?.questions.find((q) => q.id === a.questionId)?.question ?? a.questionId}</span><strong>{a.points > 0 ? "+" : ""}{a.points}</strong></div>)}{adjustments.map((a) => <div key={a.id}><span>{a.reason ?? "Manual adjustment"}</span><strong>{a.points > 0 ? "+" : ""}{a.points}</strong><button onClick={() => dispatch({ type: "UNDO_ADJUSTMENT", adjustmentId: a.id })}>Undo</button></div>)}{!awards.length && !adjustments.length && <p>No score history yet.</p>}</div><form className="exact-score" onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget); const target = Number(form.get("total")); if (Number.isFinite(target) && participant) dispatch({ type: "ADJUST", adjustment: { id: createId("adjustment"), participantId: participant.id, points: target - participant.score, reason: "Set exact total", createdAt: new Date().toISOString() } }); e.currentTarget.reset(); }}><label>Set exact total<input name="total" type="number" step="0.5" required/></label><button type="submit">Update</button></form></>; })()}</Dialog>}
  </>;
}
