"use strict";
const vocabulary = [
  ["JESUS", "Our Savior and Redeemer"],
  ["PRAYER", "Talking with Heavenly Father"],
  ["FAITH", "Trust in God"],
  ["LOVE", "Christlike care for others"],
  ["FAMILY", "People we love and care for at home"],
  ["TEMPLE", "The house of the Lord"],
  ["SERVICE", "Helping other people"],
  ["SCRIPTURE", "Sacred writings that teach about God"],
  ["PROPHET", "Someone called by God to speak for Him"],
  ["COVENANT", "A sacred promise with God"],
  ["HOPE", "Confidence in Jesus Christ"],
  ["KINDNESS", "Showing care through our actions"],
  ["PEACE", "A feeling of calm that Christ can bring"],
  ["REPENT", "Turn to God and choose to change"],
  ["BAPTISM", "An ordinance performed by immersion in water"],
  ["SABBATH", "A day set apart for worship and rest"],
  ["DISCIPLE", "Someone who follows Jesus Christ"],
  ["CHARITY", "The pure love of Christ"],
];
vocabulary.push(
  ["FORGIVE", "Let go of anger toward someone"],
  ["GRATITUDE", "Being thankful"],
  ["PATIENCE", "Staying calm while we wait"],
  ["COURAGE", "Doing what is right even when we feel afraid"],
  ["WORSHIP", "Show love and respect for God"],
  ["SACRAMENT", "Bread and water that help us remember Jesus Christ"],
  ["TESTIMONY", "A spiritual witness of truth"],
  ["JOY", "Deep happiness"],
  ["LIGHT", "What helps us see in the dark"],
  ["SHARE", "Let someone else use or enjoy what we have"],
  ["KIND", "Caring and gentle toward others"],
  ["HELP", "Do something useful for someone"],
  ["HOME", "A place where we live"],
  ["SING", "Make music with your voice"],
  ["GIVE", "Offer something to another person"],
  ["CARE", "Look after someone"],
  ["WATER", "What we drink when we are thirsty"],
  ["SEED", "A tiny beginning that can grow into a plant"],
);
const primaryVocabulary = [
  ["JESUS", "He loves us and teaches us to be kind"],
  ["PRAY", "Talk with Heavenly Father"],
  ["FAITH", "Trust in God"],
  ["LOVE", "We show this with hugs and kind words"],
  ["FAMILY", "People we love and care for at home"],
  ["TEMPLE", "A special house of the Lord"],
  ["HOPE", "Looking forward to good things"],
  ["PEACE", "Feeling calm inside"],
  ["JOY", "A word for great happiness"],
  ["KIND", "Being gentle and good to others"],
  ["HELP", "Do something good for someone"],
  ["CARE", "Look after someone"],
  ["GIVE", "Let someone have something"],
  ["SING", "Make music with your voice"],
  ["HOME", "The place where you live"],
  ["BOOK", "Pages with words and pictures"],
  ["LIGHT", "It helps us see in the dark"],
  ["WATER", "We drink this when we are thirsty"],
  ["SEED", "Plant this and watch it grow"],
  ["SHARE", "Let someone else have a turn"],
  ["SMILE", "A happy face"],
  ["GOOD", "The opposite of bad"],
  ["GOD", "Our Heavenly Father"],
  ["SUN", "It shines in the sky during the day"],
];
const pictureScenes = require("./pictures");
function random(seed) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}
function shuffle(values, rng) {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function difficulty(age) {
  return (
    {
      "3-5": 0,
      "6-8": 1,
      "9-11": 2,
      "12+": 3,
      "12-17": 3,
      "18-35": 3,
      "36-55": 3,
      "56+": 3,
    }[age] ?? 1
  );
}
function buildCrossword(age, level, attempt = 0) {
  const rng = random(level * 97 + difficulty(age) * 1009 + 41 + attempt * 9973),
    size = 25,
    grid = Array.from({ length: size }, () => Array(size).fill(null)),
    directions = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => new Set()),
    );
  const tier = difficulty(age),
    bank =
      tier < 2
        ? primaryVocabulary
        : vocabulary.filter(([word]) => tier === 3 || word.length <= 9);
  const pool = shuffle(
      bank.filter(([word]) => tier > 0 || word.length <= 6),
      rng,
    ),
    placed = [],
    target =
      tier === 0
        ? level < 5
          ? 2
          : 3
        : tier === 1
          ? level < 5
            ? 3
            : 4
          : tier === 2
            ? level < 5
              ? 5
              : 6
            : 9;
  function valid(word, row, col, dir) {
    const dr = dir === "down" ? 1 : 0,
      dc = 1 - dr;
    let crossings = 0;
    if (
      row < 0 ||
      col < 0 ||
      row + dr * (word.length - 1) >= size ||
      col + dc * (word.length - 1) >= size
    )
      return false;
    if (
      grid[row - dr]?.[col - dc] ||
      grid[row + dr * word.length]?.[col + dc * word.length]
    )
      return false;
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i,
        c = col + dc * i;
      if (grid[r][c]) {
        if (grid[r][c] !== word[i] || directions[r][c].has(dir)) return false;
        crossings++;
      } else if (grid[r - dc]?.[c - dr] || grid[r + dc]?.[c + dr]) return false;
    }
    if (placed.length && !crossings) return false;
    const rows = [
        ...placed.flatMap((p) => [
          p.row,
          p.row + (p.dir === "down" ? p.word.length - 1 : 0),
        ]),
        row,
        row + dr * (word.length - 1),
      ],
      cols = [
        ...placed.flatMap((p) => [
          p.col,
          p.col + (p.dir === "across" ? p.word.length - 1 : 0),
        ]),
        col,
        col + dc * (word.length - 1),
      ];
    return (
      Math.max(...rows) - Math.min(...rows) < 17 &&
      Math.max(...cols) - Math.min(...cols) < 17
    );
  }
  function put(word, clue, row, col, dir) {
    for (let i = 0; i < word.length; i++) {
      const r = row + (dir === "down" ? i : 0),
        c = col + (dir === "across" ? i : 0);
      grid[r][c] = word[i];
      directions[r][c].add(dir);
    }
    placed.push({ word, clue, row, col, dir });
  }
  const first = pool.shift();
  put(...first, 12, Math.floor((size - first[0].length) / 2), "across");
  for (let pass = 0; pass < 3 && placed.length < target; pass++)
    for (const [word, clue] of pool) {
      if (placed.some((p) => p.word === word) || placed.length >= target)
        continue;
      const candidates = [];
      for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++)
          if (grid[r][c])
            for (let i = 0; i < word.length; i++)
              if (word[i] === grid[r][c])
                for (const dir of ["across", "down"]) {
                  const row = r - (dir === "down" ? i : 0),
                    col = c - (dir === "across" ? i : 0);
                  if (valid(word, row, col, dir))
                    candidates.push({ row, col, dir });
                }
      if (candidates.length) {
        const p = candidates[Math.floor(rng() * candidates.length)];
        put(word, clue, p.row, p.col, p.dir);
      }
    }
  const minR = Math.min(...placed.map((p) => p.row)),
    minC = Math.min(...placed.map((p) => p.col)),
    maxR = Math.max(
      ...placed.map((p) => p.row + (p.dir === "down" ? p.word.length - 1 : 0)),
    ),
    maxC = Math.max(
      ...placed.map(
        (p) => p.col + (p.dir === "across" ? p.word.length - 1 : 0),
      ),
    );
  const solution = grid
    .slice(minR, maxR + 1)
    .map((row) => row.slice(minC, maxC + 1));
  const starts = [...new Set(placed.map((p) => `${p.row},${p.col}`))].sort(
    (a, b) => {
      const [r, c] = a.split(",").map(Number),
        [rr, cc] = b.split(",").map(Number);
      return r - rr || c - cc;
    },
  );
  const clues = placed
    .map((p) => ({
      number: starts.indexOf(`${p.row},${p.col}`) + 1,
      row: p.row - minR,
      col: p.col - minC,
      direction: p.dir,
      length: p.word.length,
      clue: p.clue,
    }))
    .sort((a, b) => a.number - b.number);
  const help =
    tier < 3
      ? {
          wordBank: shuffle(
            placed.map((p) => p.word),
            random(level + 19),
          ),
          showWordBank: tier === 0,
        }
      : {};
  const givens =
    tier === 0
      ? Object.fromEntries(
          placed.map((p) => [`${p.row - minR},${p.col - minC}`, p.word[0]]),
        )
      : {};
  return {
    type: "crossword",
    question:
      tier === 0
        ? "Ask a grown-up to read the clues with you. Use the word bank; the first letters are already filled in."
        : "Fill the interlocking grid. Every crossing shares a letter.",
    cells: solution.map((row) => row.map((c) => c !== null)),
    clues,
    givens,
    ...help,
    solution,
  };
}
const crosswordCache = new Map();
function crosswordPuzzle(age, level) {
  const tier = difficulty(age);
  if (!crosswordCache.has(tier)) crosswordCache.set(tier, []);
  const puzzles = crosswordCache.get(tier);
  for (let n = puzzles.length; n <= level; n++) {
    let puzzle,
      signature,
      attempt = 0;
    do {
      puzzle = buildCrossword(age, n, attempt++);
      signature = puzzle.clues
        .map((c) =>
          Array.from(
            { length: c.length },
            (_, i) =>
              puzzle.solution[c.row + (c.direction === "down" ? i : 0)][
                c.col + (c.direction === "across" ? i : 0)
              ],
          ).join(""),
        )
        .sort()
        .join("|");
    } while (puzzles.some((p) => p.signature === signature) && attempt < 100);
    if (puzzles.some((p) => p.signature === signature))
      throw Error("Unable to make a fresh crossword");
    puzzles.push({ signature, puzzle });
  }
  return structuredClone(puzzles[level].puzzle);
}
function wordSearch(age, level) {
  const rng = random(level * 233 + difficulty(age) * 311 + 5),
    size = [7, 9, 10, 12][difficulty(age)],
    words = shuffle(
      vocabulary.filter(([w]) => w.length <= size),
      rng,
    )
      .slice(0, [3, 4, 5, 6][difficulty(age)])
      .map(([w]) => w),
    grid = Array.from({ length: size }, () => Array(size).fill(""));
  const dirs =
    difficulty(age) < 1
      ? [
          [0, 1],
          [1, 0],
        ]
      : [
          [0, 1],
          [1, 0],
          [1, 1],
          [0, -1],
          [-1, 0],
          [-1, -1],
        ];
  for (const word of words) {
    let done = false;
    for (let attempt = 0; attempt < 500 && !done; attempt++) {
      const [dr, dc] = dirs[Math.floor(rng() * dirs.length)],
        r = Math.floor(rng() * size),
        c = Math.floor(rng() * size);
      if (
        r + dr * (word.length - 1) < 0 ||
        r + dr * (word.length - 1) >= size ||
        c + dc * (word.length - 1) < 0 ||
        c + dc * (word.length - 1) >= size
      )
        continue;
      if (
        [...word].every(
          (letter, i) =>
            !grid[r + dr * i][c + dc * i] ||
            grid[r + dr * i][c + dc * i] === letter,
        )
      ) {
        [...word].forEach(
          (letter, i) => (grid[r + dr * i][c + dc * i] = letter),
        );
        done = true;
      }
    }
    if (!done) return wordSearch(age, level + 100);
  }
  for (const row of grid)
    for (let c = 0; c < size; c++)
      if (!row[c])
        row[c] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(rng() * 26)];
  return {
    type: "wordsearch",
    question: "Tap the first and last letter of each hidden gospel word.",
    grid,
    words,
  };
}
const pairs = [
  ["Prayer", "Talking with Heavenly Father"],
  ["Faith", "Trusting in God"],
  ["Service", "Helping others"],
  ["Temple", "House of the Lord"],
  ["Charity", "Pure love of Christ"],
  ["Repentance", "Turning to God and changing"],
  ["Scriptures", "Sacred writings"],
  ["Covenant", "Sacred promise with God"],
  ["Prophet", "Called to speak for God"],
  ["Baptism", "An ordinance by immersion"],
  ["Disciple", "Follower of Jesus Christ"],
  ["Sabbath", "Day of worship and rest"],
];
function matching(age, level) {
  const rng = random(level * 67 + 91),
    chosen = shuffle(pairs, rng).slice(0, [3, 4, 5, 6][difficulty(age)]),
    right = shuffle(
      chosen.map((p, i) => ({ text: p[1], source: i })),
      rng,
    );
  return {
    type: "matching",
    question:
      "Draw a line from each word to its meaning, or tap one item in each column. Blue means correct; red means try again.",
    left: chosen.map((p, i) => ({ id: "l" + i, text: p[0] })),
    right: right.map((p, i) => ({ id: "r" + i, text: p.text })),
    solution: Object.fromEntries(
      chosen.map((p, i) => [
        "l" + i,
        "r" + right.findIndex((v) => v.source === i),
      ]),
    ),
  };
}
function temple(age, level) {
  const tier = difficulty(age),
    size = tier < 2 ? 2 : 3,
    rng = random(level * 43 + 13),
    picture = pictureScenes[level % pictureScenes.length];
  let tiles = Array.from({ length: size * size }, (_, i) => i);
  if (tier === 0) {
    const first = Math.floor(rng() * tiles.length),
      second =
        (first + 1 + Math.floor(rng() * (tiles.length - 1))) % tiles.length;
    [tiles[first], tiles[second]] = [tiles[second], tiles[first]];
  } else tiles = shuffle(tiles, rng);
  if (tiles.every((v, i) => v === i))
    [tiles[0], tiles[1]] = [tiles[1], tiles[0]];
  return {
    type: "tiles",
    question: `${picture.title}. Tap two tiles to swap their places.${tier === 0 ? " Two pieces need to trade places. A grown-up can help." : ""}`,
    size,
    tiles,
    image: picture.image,
    imageTitle: picture.title,
    imageAlt: picture.alt,
    showNumbers: tier < 3,
  };
}
const heroes = [
  [
    "Who built an ark when the Lord warned of a flood?",
    "Noah",
    ["Moses", "Nephi"],
    "Genesis 6:13–22",
  ],
  [
    "Who led the children of Israel out of Egypt?",
    "Moses",
    ["Noah", "Daniel"],
    "Exodus 3:10",
  ],
  [
    "Who prayed even when it meant facing lions?",
    "Daniel",
    ["Jonah", "Lehi"],
    "Daniel 6:10–23",
  ],
  [
    "Who went to Nineveh after being swallowed by a great fish?",
    "Jonah",
    ["Peter", "Mormon"],
    "Jonah 1–3",
  ],
  [
    "Who said, “I will go and do the things which the Lord hath commanded”?",
    "Nephi",
    ["Laman", "Alma"],
    "1 Nephi 3:7",
  ],
  [
    "Who listened when the Lord called him as a child?",
    "Samuel",
    ["David", "Paul"],
    "1 Samuel 3",
  ],
  [
    "Who defeated Goliath with a sling and a stone?",
    "David",
    ["Solomon", "Saul"],
    "1 Samuel 17",
  ],
  [
    "Who was a queen who helped save her people?",
    "Esther",
    ["Ruth", "Martha"],
    "Esther 4–8",
  ],
  ["Who chose to stay with Naomi?", "Ruth", ["Esther", "Eve"], "Ruth 1:16"],
  [
    "Who led the two thousand young warriors?",
    "Helaman",
    ["Moroni", "Ammon"],
    "Alma 53:22",
  ],
  [
    "Who served King Lamoni and protected his flocks?",
    "Ammon",
    ["Aaron", "Alma"],
    "Alma 17",
  ],
  [
    "Who climbed a tree to see Jesus?",
    "Zacchaeus",
    ["Nicodemus", "Thomas"],
    "Luke 19:1–10",
  ],
  [
    "Who was the mother of Jesus?",
    "Mary",
    ["Martha", "Elizabeth"],
    "Luke 1:26–35",
  ],
  [
    "Who baptized Jesus in the River Jordan?",
    "John the Baptist",
    ["Peter", "Paul"],
    "Matthew 3:13–17",
  ],
  [
    "Who is the Savior of the world?",
    "Jesus Christ",
    ["Moses", "Elijah"],
    "John 4:42",
  ],
];
function hero(age, level) {
  const row = heroes[(level + difficulty(age) * 3) % heroes.length],
    options = shuffle([row[1], ...row[2]], random(level * 17 + 3));
  return {
    type: "choice",
    question: row[0],
    options,
    answer: options.indexOf(row[1]),
    reference: row[3],
  };
}
const historySets = [
  {
    title: "The Restoration begins",
    reference:
      "Joseph Smith—History 1:11–17, 27–35, 59; Doctrine and Covenants 20:1",
    events: [
      ["1820", "Joseph Smith prays in the Sacred Grove"],
      ["1823", "Moroni first visits Joseph Smith"],
      ["1827", "Joseph Smith receives the gold plates"],
      ["1830", "The Church is organized"],
    ],
  },
  {
    title: "Lehi’s family journeys",
    reference: "1 Nephi 2, 3–4, 16, 17–18",
    events: [
      ["1", "Lehi’s family leaves Jerusalem"],
      ["2", "Nephi and his brothers obtain the brass plates"],
      ["3", "The family receives the Liahona"],
      ["4", "Nephi builds a ship"],
      ["5", "The family reaches the promised land"],
    ],
  },
  {
    title: "The Savior’s mortal ministry",
    reference: "Luke 2; Matthew 3; Luke 22–24",
    events: [
      ["1", "Jesus is born in Bethlehem"],
      ["2", "Jesus is baptized by John"],
      ["3", "Jesus shares the Last Supper"],
      ["4", "Jesus suffers, dies, and is buried"],
      ["5", "Jesus Christ is resurrected"],
    ],
  },
  {
    title: "Faith across generations",
    reference: "Genesis 6–9; Exodus 3–14; Matthew 1–3; Joseph Smith—History 1",
    events: [
      ["1", "Noah builds the ark"],
      ["2", "Moses leads Israel out of Egypt"],
      ["3", "Jesus Christ begins His mortal ministry"],
      ["4", "Joseph Smith prays in the Sacred Grove"],
    ],
  },
  {
    title: "The Book of Mormon comes forth",
    reference:
      "Joseph Smith—History 1:27–35, 59; Doctrine and Covenants 13; 20:1",
    events: [
      ["1823", "Moroni first visits Joseph Smith"],
      ["1827", "Joseph Smith receives the gold plates"],
      ["1829", "John the Baptist restores the Aaronic Priesthood"],
      ["1830", "The Book of Mormon is published"],
    ],
  },
];
historySets.push(
  {
    title: "The Creation",
    reference: "Genesis 1",
    events: [
      ["1", "God creates light"],
      ["2", "God makes dry land appear and plants grow"],
      ["3", "God places lights in the heavens"],
      ["4", "God creates fish and birds"],
      ["5", "God creates land animals and humankind"],
    ],
  },
  {
    title: "Noah’s faithful journey",
    reference: "Genesis 6–9",
    events: [
      ["1", "God commands Noah to build an ark"],
      ["2", "Noah’s family and the animals enter the ark"],
      ["3", "The flood covers the earth"],
      ["4", "Noah’s family leaves the ark"],
      ["5", "God gives the rainbow as a token of His covenant"],
    ],
  },
  {
    title: "Moses answers the call",
    reference: "Exodus 2–3, 12–14, 19–20",
    events: [
      ["1", "Moses is placed in a basket by the river"],
      ["2", "Pharaoh’s daughter finds Moses"],
      ["3", "God calls Moses at the burning bush"],
      ["4", "Moses leads Israel out of Egypt"],
      ["5", "God gives commandments at Mount Sinai"],
    ],
  },
  {
    title: "David’s early journey",
    reference: "1 Samuel 16–17; 2 Samuel 5",
    events: [
      ["1", "Samuel anoints David"],
      ["2", "David faces Goliath with faith in God"],
      ["3", "David becomes king over Israel"],
    ],
  },
  {
    title: "Daniel chooses faith",
    reference: "Daniel 1, 6",
    events: [
      ["1", "Daniel is taken to Babylon"],
      ["2", "Daniel asks for simple food and water"],
      ["3", "A law forbids prayer to anyone except the king"],
      ["4", "Daniel continues to pray to God"],
      ["5", "God protects Daniel in the lions’ den"],
    ],
  },
  {
    title: "Jonah learns compassion",
    reference: "Jonah 1–4",
    events: [
      ["1", "God calls Jonah to go to Nineveh"],
      ["2", "Jonah boards a ship going another way"],
      ["3", "A great fish swallows Jonah"],
      ["4", "Jonah preaches to the people of Nineveh"],
      ["5", "The people repent and God shows mercy"],
    ],
  },
  {
    title: "The first Christmas",
    reference: "Luke 1–2",
    events: [
      ["1", "An angel tells Mary she will be the mother of Jesus"],
      ["2", "Mary and Joseph travel to Bethlehem"],
      ["3", "Jesus is born"],
      ["4", "Angels announce His birth to shepherds"],
      ["5", "The shepherds visit the baby Jesus"],
    ],
  },
  {
    title: "The good Samaritan",
    reference: "Luke 10:30–37",
    events: [
      ["1", "A traveler is hurt by robbers"],
      ["2", "A priest and a Levite pass by"],
      ["3", "A Samaritan stops and cares for the traveler"],
      ["4", "The Samaritan takes him to an inn"],
      ["5", "The Samaritan pays for his care"],
    ],
  },
  {
    title: "The Savior visits the Nephites",
    reference: "3 Nephi 11, 17–18",
    events: [
      ["1", "The people gather at the temple in Bountiful"],
      ["2", "Jesus Christ appears and invites them to come to Him"],
      ["3", "Jesus heals the sick and blesses the children"],
      ["4", "Jesus teaches the people about the sacrament"],
    ],
  },
  {
    title: "Alma’s change of heart",
    reference: "Mosiah 27; Alma 17:1–4",
    events: [
      ["1", "Alma and the sons of Mosiah oppose the Church"],
      ["2", "An angel calls them to repentance"],
      ["3", "Alma turns to God and recovers his strength"],
      ["4", "They teach others about the Redeemer"],
      ["5", "The sons of Mosiah serve missions among the Lamanites"],
    ],
  },
);

function history(age, level) {
  const set = historySets[level % historySets.length],
    events = set.events
      .slice(0, difficulty(age) === 0 ? 3 : undefined)
      .map((p, i) => ({ id: "e" + i, text: p[1] }));
  let shuffled = shuffle(events, random(level * 71 + 11));
  if (shuffled.every((v, i) => v.id === events[i].id)) shuffled.reverse();
  return {
    type: "timeline",
    question: set.title + ": put these events in order, earliest first.",
    events: shuffled,
    solution: events.map((e) => e.id),
    reference: set.reference,
  };
}
function makeChallenge(game, age, level) {
  return {
    crossword: crosswordPuzzle,
    wordhunt: wordSearch,
    matching,
    temple,
    heroes: hero,
    history,
  }[game](age, level);
}
function publicPuzzle(puzzle) {
  const { solution, answer, ...rest } = puzzle;
  return rest;
}
function checkAnswer(p, a) {
  if (p.type === "choice")
    return (
      typeof a === "string" && /^[0-9]+$/.test(a) && Number(a) === p.answer
    );
  if (p.type === "crossword")
    return (
      !!a &&
      typeof a === "object" &&
      p.solution.every((row, r) =>
        row.every(
          (v, c) =>
            v === null || String(a[`${r},${c}`] || "").toUpperCase() === v,
        ),
      )
    );
  if (p.type === "matching")
    return (
      !!a &&
      typeof a === "object" &&
      Object.entries(p.solution).every(([key, value]) => a[key] === value)
    );
  if (p.type === "tiles")
    return (
      Array.isArray(a) &&
      a.length === p.size * p.size &&
      a.every((v, i) => v === i)
    );
  if (p.type === "timeline")
    return (
      Array.isArray(a) &&
      a.length === p.solution.length &&
      a.every((v, i) => v === p.solution[i])
    );
  if (p.type === "wordsearch") {
    if (!Array.isArray(a) || a.length !== p.words.length) return false;
    const found = new Set();
    for (const path of a) {
      if (
        !Array.isArray(path) ||
        path.length !== 4 ||
        !path.every(Number.isInteger)
      )
        return false;
      const [r, c, rr, cc] = path,
        size = p.grid.length;
      if ([r, c, rr, cc].some((v) => v < 0 || v >= size)) return false;
      const dr = Math.sign(rr - r),
        dc = Math.sign(cc - c),
        length = Math.max(Math.abs(rr - r), Math.abs(cc - c)) + 1;
      if (
        length < 2 ||
        r + dr * (length - 1) !== rr ||
        c + dc * (length - 1) !== cc
      )
        return false;
      let word = "";
      for (let i = 0; i < length; i++) word += p.grid[r + dr * i][c + dc * i];
      if (!p.words.includes(word)) {
        word = [...word].reverse().join("");
        if (!p.words.includes(word)) return false;
      }
      found.add(word);
    }
    return found.size === p.words.length;
  }
  return false;
}
function crosswordHint(puzzle, clueNumber, direction, answers) {
  if (
    puzzle.type !== "crossword" ||
    !Number.isInteger(clueNumber) ||
    !["across", "down"].includes(direction) ||
    !answers ||
    typeof answers !== "object" ||
    Array.isArray(answers)
  )
    return null;
  const clue = puzzle.clues.find(
    (item) => item.number === clueNumber && item.direction === direction,
  );
  if (!clue) return null;
  for (let i = 0; i < clue.length; i++) {
    const row = clue.row + (direction === "down" ? i : 0),
      col = clue.col + (direction === "across" ? i : 0),
      letter = puzzle.solution[row][col];
    if (
      typeof letter === "string" &&
      String(answers[`${row},${col}`] || "").toUpperCase() !== letter
    )
      return { row, col, letter };
  }
  return null;
}
module.exports = {
  makeChallenge,
  publicPuzzle,
  checkAnswer,
  crosswordHint,
  vocabulary,
  reviewContent: () => ({ vocabulary, pairs, heroes, historySets }),
};
