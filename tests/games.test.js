"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { conferenceState } = require("../lib/conference");
const {
  makeChallenge,
  publicPuzzle,
  checkAnswer,
  crosswordHint,
} = require("../lib/games");
test("conference transitions use Ghana time with exclusive session ends", () => {
  for (const [time, mode] of [
    ["2026-10-31T10:59:59Z", "free"],
    ["2026-10-31T11:00:00Z", "leadership"],
    ["2026-10-31T12:59:59Z", "leadership"],
    ["2026-10-31T13:00:00Z", "free"],
    ["2026-10-31T13:30:00Z", "adult"],
    ["2026-10-31T15:30:00Z", "free"],
    ["2026-11-01T09:59:59Z", "free"],
    ["2026-11-01T10:00:00Z", "general"],
    ["2026-11-01T12:00:00Z", "free"],
  ])
    assert.equal(conferenceState(Date.parse(time)).mode, mode);
  assert.equal(conferenceState(Date.parse("2026-11-01T11:00:00Z")).quiet, true);
  assert.equal(
    conferenceState(Date.parse("2026-11-01T11:00:00Z"), "free").quiet,
    false,
  );
  assert.equal(
    conferenceState(Date.parse("2026-10-25T11:00:00Z"), "general").quiet,
    true,
  );
});
function searchPaths(p) {
  return p.words.map((word) => {
    const size = p.grid.length;
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        for (const [dr, dc] of [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
          [1, 1],
          [-1, -1],
          [1, -1],
          [-1, 1],
        ]) {
          let match = true;
          for (let i = 0; i < word.length; i++)
            if (p.grid[r + dr * i]?.[c + dc * i] !== word[i]) {
              match = false;
              break;
            }
          if (match)
            return [
              r,
              c,
              r + dr * (word.length - 1),
              c + dc * (word.length - 1),
            ];
        }
    throw Error("Word missing: " + word);
  });
}
for (const age of ["3-5", "6-8", "9-11", "12-17", "18-35", "36-55", "56+"])
  test(`all 15 levels of six engines are solvable for ages ${age}`, () => {
    for (let level = 0; level < 15; level++)
      for (const game of [
        "crossword",
        "wordhunt",
        "heroes",
        "matching",
        "temple",
        "history",
      ]) {
        const p = makeChallenge(game, age, level),
          safe = publicPuzzle(p);
        assert.equal(safe.solution, undefined);
        assert.equal(safe.answer, undefined);
        assert.equal(checkAnswer(p, null), false);
        let answer;
        if (p.type === "crossword") {
          assert.ok(
            p.clues.length >=
              (age === "3-5" ? 2 : age === "6-8" ? 3 : age === "9-11" ? 5 : 9),
          );
          answer = {};
          p.solution.forEach((row, r) =>
            row.forEach((letter, c) => {
              if (letter) answer[`${r},${c}`] = letter;
            }),
          );
          const seen = new Set(),
            todo = [Object.keys(answer)[0]];
          while (todo.length) {
            const key = todo.pop();
            if (seen.has(key)) continue;
            seen.add(key);
            const [r, c] = key.split(",").map(Number);
            for (const next of [
              `${r - 1},${c}`,
              `${r + 1},${c}`,
              `${r},${c - 1}`,
              `${r},${c + 1}`,
            ])
              if (answer[next] && !seen.has(next)) todo.push(next);
          }
          assert.equal(
            seen.size,
            Object.keys(answer).length,
            "Grid must be connected",
          );
          for (const clue of p.clues) {
            let word = "";
            for (let i = 0; i < clue.length; i++)
              word +=
                answer[
                  `${clue.row + (clue.direction === "down" ? i : 0)},${clue.col + (clue.direction === "across" ? i : 0)}`
                ];
            assert.equal(word.length, clue.length);
          }
        } else if (p.type === "wordsearch") {
          answer = searchPaths(p);
          assert.equal(checkAnswer(p, answer.slice(1)), false);
        } else if (p.type === "tiles") {
          answer = Array.from({ length: p.size * p.size }, (_, i) => i);
          assert.equal(checkAnswer(p, p.tiles), false);
        } else if (p.type === "choice") answer = String(p.answer);
        else answer = p.solution;
        assert.equal(
          checkAnswer(p, answer),
          true,
          `${game} level ${level + 1}`,
        );
        assert.deepEqual(
          makeChallenge(game, age, level),
          p,
          "Puzzle must be stable across requests",
        );
      }
  });

test("legacy 12+ accounts retain the same puzzle difficulty", () => {
  assert.deepEqual(
    makeChallenge("crossword", "12+", 0),
    makeChallenge("crossword", "12-17", 0),
  );
});

test("every picture level uses a different local illustration", () => {
  const fs = require("node:fs"),
    path = require("node:path");
  const pictures = Array.from({ length: 15 }, (_, level) =>
    makeChallenge("temple", "6-8", level),
  );
  assert.equal(new Set(pictures.map((p) => p.image)).size, 15);
  assert.equal(new Set(pictures.map((p) => p.imageTitle)).size, 15);
  const art = pictures.map((p) => {
    assert.ok(p.imageAlt.length > 20);
    const file = path.join(__dirname, "..", "public", p.image);
    assert.ok(fs.existsSync(file));
    return fs.readFileSync(file, "utf8");
  });
  assert.equal(new Set(art).size, 15);
});
test("crossword word sets do not repeat within any age group", () => {
  for (const age of ["3-5", "6-8", "9-11", "12-17", "18-35", "36-55", "56+"]) {
    const keys = Array.from({ length: 15 }, (_, level) => {
      const p = makeChallenge("crossword", age, level);
      return p.clues
        .map((c) =>
          Array.from(
            { length: c.length },
            (_, i) =>
              p.solution[c.row + (c.direction === "down" ? i : 0)][
                c.col + (c.direction === "across" ? i : 0)
              ],
          ).join(""),
        )
        .sort()
        .join("|");
    });
    assert.equal(new Set(keys).size, 15, age);
  }
});
test("Primary children receive smaller puzzles and age-appropriate crossword support", () => {
  for (let level = 0; level < 15; level++)
    for (const age of ["3-5", "6-8", "9-11"]) {
      const picture = makeChallenge("temple", age, level),
        p = makeChallenge("crossword", age, level);
      assert.equal(picture.size, age === "9-11" ? 3 : 2);
      assert.equal(picture.showNumbers, true);
      assert.ok(p.wordBank.length === p.clues.length);
      assert.ok(
        p.clues.every(
          (c) => c.length <= (age === "3-5" ? 6 : age === "6-8" ? 6 : 9),
        ),
      );
      if (age === "3-5") {
        assert.ok(p.clues.length <= 3);
        assert.equal(p.showWordBank, true);
        assert.ok(Object.keys(p.givens).length > 0);
        for (const [key, letter] of Object.entries(p.givens)) {
          const [r, c] = key.split(",").map(Number);
          assert.equal(p.solution[r][c], letter);
        }
        assert.equal(picture.tiles.filter((tile, i) => tile !== i).length, 2);
      } else if (age === "6-8") {
        assert.ok(p.clues.length <= 4);
        assert.equal(p.showWordBank, false);
      } else assert.ok(p.clues.length <= 6);
    }
});
test("crossword hints reveal only the next missing or incorrect letter", () => {
  const puzzle = makeChallenge("crossword", "18-35", 0),
    clue = puzzle.clues[0],
    answers = {};
  for (let i = 0; i < clue.length; i++) {
    const row = clue.row + (clue.direction === "down" ? i : 0),
      col = clue.col + (clue.direction === "across" ? i : 0),
      letter = puzzle.solution[row][col];
    answers[`${row},${col}`] = i === 0 ? "?" : letter;
  }
  const hint = crosswordHint(puzzle, clue.number, clue.direction, answers);
  assert.deepEqual(hint, {
    row: clue.row,
    col: clue.col,
    letter: puzzle.solution[clue.row][clue.col],
  });
  answers[`${clue.row},${clue.col}`] = hint.letter;
  assert.equal(crosswordHint(puzzle, clue.number, clue.direction, answers), null);
  assert.equal(crosswordHint(puzzle, clue.number, "diagonal", answers), null);
});
