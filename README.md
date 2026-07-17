# Quizmaster Local

A polished, single-screen quiz hosting app for a host, projector, or television. It runs entirely in the browser: there is no backend, account, database, or external API.

## Setup

Requires a current Node.js installation.

```bash
npm install
npm run dev
```

Vite prints the local address to open. The development server is local-only by default.

To make the development server available to another device on the same network:

```bash
npm run dev -- --host
```

This exposes the development server to your local network. Only use it on a network you trust.

## Building

```bash
npm run build
npm run preview
```

Run automated behaviour tests and lint checks with:

```bash
npm test
npm run lint
```

## Quiz library

Quizzes live in a local manifest-driven library:

```text
public/
  quizzes/
    index.json
    my-quiz.json
```

Adding a quiz takes two steps:

1. Create a JSON quiz file inside `public/quizzes/`.
2. Add its stable ID and relative filename to `public/quizzes/index.json`.

Use URL-safe filenames without spaces where practical. Files must stay inside `public/quizzes/`; absolute paths, external URLs, backslashes, and `..` path traversal are rejected.

The manifest identifies files only. The visible quiz title always comes from the quiz file's `title` property.

```json
{
  "quizzes": [
    {
      "id": "my-quiz",
      "file": "my-quiz.json"
    },
    {
      "id": "advanced-science",
      "file": "science/advanced-science.json"
    }
  ]
}
```

## Editing a quiz

Every quiz file uses this complete format:

```json
{
  "title": "My Quiz Name",
  "description": "A general knowledge quiz.",
  "settings": {
    "shuffleQuestions": false
  },
  "questions": [
    {
      "id": "capital-nz",
      "question": "What is the capital of New Zealand?",
      "answerType": "single",
      "answers": ["Wellington"],
      "choices": ["Auckland", "Christchurch", "Wellington", "Dunedin"],
      "points": 1,
      "category": "Geography",
      "notes": "Optional host-only note."
    },
    {
      "id": "light-colours",
      "question": "Name the primary colours of light.",
      "answerType": "multiple",
      "answers": ["Red", "Green", "Blue"],
      "points": 3,
      "category": "Science"
    },
    {
      "id": "hotel-name",
      "question": "Pitch the worst name for a luxury hotel.",
      "answerType": "open",
      "answers": [],
      "points": 2,
      "category": "Creative",
      "notes": "The host chooses the winner."
    }
  ]
}
```

`answerType` must be `single`, `multiple`, or `open`. A single-answer question requires at least one answer. Open questions may use an empty answer list. Add an optional `choices` array to display two or more possible answers before the host reveals the result. At least one choice must exactly match an accepted answer; multiple-answer questions may contain several correct choices. `points` must be zero or greater. Category and notes are optional. Every question needs a stable, unique `id`; changing IDs during a saved game makes that saved session incompatible.

The repository includes:

- `great-knowledge-challenge.json`: a 40-question, four-round general-knowledge quiz.
- `example-quiz.json`: a small example covering all three answer types.

If one listed quiz is malformed, the selection screen reports that file as unavailable while leaving other valid quizzes selectable.

## Hosting a game

Add players, choose solo or team mode, and start. In team mode, create teams and assign every player. During play, tick any number of participants and adjust their point values. **Apply selected points** saves immediately; **Next** also saves the current selections before moving on, with every unselected participant receiving zero. Use **No one answered correctly** to record a completed zero-score round explicitly, or **Skip** when the question was not played.

Every multiple-choice answer list is shuffled once when a game starts. That order is saved with the session, stays stable while revisiting questions or refreshing the browser, and is shuffled again for a rematch.

Quick `+` and `−` controls create manual score adjustments. Select a participant's name to inspect their score history, undo manual changes, or set an exact total. Exact totals are stored as the difference from the calculated score, preserving question history.

Keyboard shortcuts work when no input is focused: Space reveals or hides the answer, P pauses, and F toggles fullscreen. Question navigation uses the on-screen controls so moving forward always follows the scoring workflow.

## Saving and resuming

Progress is automatically stored in browser `localStorage` under:

```text
local-quiz-host.session.v1
```

The saved data includes the selected quiz ID and filename, quiz fingerprint, roster, teams, status, current question, awards, adjustments, and answer visibility. On reload, the app loads the matching manifest quiz before asking whether to resume. A fingerprint made from the quiz title and question IDs prevents a session from being restored into a changed or different quiz.

## Resetting

Use **Full reset** or **Clear saved setup** in the app and confirm the stronger reset dialog. To clear it manually, open the browser's developer tools, visit Application/Storage → Local Storage, and delete `local-quiz-host.session.v1`. Clearing all site data also removes it.

## Results

Final results use competition ranking for ties (`1, 1, 3`), include session statistics, and can be printed or exported as JSON. A rematch keeps the roster and teams while clearing all scoring.
