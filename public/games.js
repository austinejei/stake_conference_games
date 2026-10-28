"use strict";
window.ExplorerGames = {
  render(p, container, options = {}) {
    const make = (tag, cls, value) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (value !== undefined) e.textContent = value;
      return e;
    };
    let answer = () => null,
      gridObserver = null;
    function gridHelp(scroll, board) {
      const hint = make(
        "p",
        "grid-scroll-hint",
        "Swipe sideways inside the grid to see more.",
      );
      const update = () =>
        (hint.hidden = board.scrollWidth <= scroll.clientWidth + 1);
      gridObserver = new ResizeObserver(update);
      gridObserver.observe(scroll);
      requestAnimationFrame(update);
      return hint;
    }
    if (p.type === "crossword") {
      const wrap = make("div", "crossword-layout"),
        board = make("div", "crossword-board"),
        clueBox = make("div", "clue-lists");
      board.style.setProperty("--cols", p.cells[0].length);
      board.setAttribute("role", "group");
      board.setAttribute("aria-label", "Crossword grid");
      const inputs = new Map(),
        labels = new Map();
      let direction = "across",
        selectedClue = null;
      function wordCells(clue) {
        return Array.from(
          { length: clue.length },
          (_, i) =>
            `${clue.row + (clue.direction === "down" ? i : 0)},${clue.col + (clue.direction === "across" ? i : 0)}`,
        );
      }
      function activate(key) {
        const clues = p.clues.filter((clue) => wordCells(clue).includes(key)),
          clue = clues.find((c) => c.direction === direction) || clues[0];
        if (!clue) return;
        direction = clue.direction;
        selectedClue = clue;
        for (const [id, input] of inputs)
          input.parentElement.classList.toggle(
            "word-active",
            wordCells(clue).includes(id),
          );
        for (const [id, label] of labels)
          label.classList.toggle(
            "selected-clue",
            id === `${clue.number}-${clue.direction}`,
          );
      }
      function step(r, c, delta) {
        for (let n = 1; n <= Math.max(p.cells.length, p.cells[0].length); n++) {
          const key = `${r + (direction === "down" ? delta * n : 0)},${c + (direction === "across" ? delta * n : 0)}`,
            next = inputs.get(key);
          if (!next) return;
          if (!next.readOnly) {
            next.focus();
            return;
          }
        }
      }
      p.cells.forEach((row, r) =>
        row.forEach((open, c) => {
          const cell = make("div", open ? "crossword-cell" : "crossword-block");
          if (open) {
            const start = p.clues.find(
              (clue) => clue.row === r && clue.col === c,
            );
            if (start)
              cell.appendChild(make("span", "cell-number", start.number));
            const input = make("input");
            input.maxLength = 1;
            input.name = `${r},${c}`;
            if (p.givens?.[`${r},${c}`]) {
              input.value = p.givens[`${r},${c}`];
              input.readOnly = true;
              cell.classList.add("given-letter");
            }
            input.autocomplete = "off";
            input.spellcheck = false;
            input.inputMode = "text";
            input.setAttribute(
              "aria-label",
              `Row ${r + 1}, column ${c + 1}${start ? ", clue " + start.number : ""}`,
            );
            input.onfocus = () => activate(`${r},${c}`);
            input.onclick = () => {
              const crossing = p.clues.filter((clue) =>
                wordCells(clue).includes(`${r},${c}`),
              );
              if (crossing.length > 1) {
                direction = direction === "across" ? "down" : "across";
                activate(`${r},${c}`);
              }
            };
            input.oninput = () => {
              input.value = input.value.replace(/[^a-z]/gi, "").toUpperCase();
              if (input.value) step(r, c, 1);
            };
            input.onkeydown = (e) => {
              if (
                ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(
                  e.key,
                )
              ) {
                e.preventDefault();
                direction = ["ArrowUp", "ArrowDown"].includes(e.key)
                  ? "down"
                  : "across";
                step(r, c, ["ArrowLeft", "ArrowUp"].includes(e.key) ? -1 : 1);
              } else if (e.key === "Backspace" && !input.value) {
                e.preventDefault();
                step(r, c, -1);
              }
            };
            inputs.set(`${r},${c}`, input);
            cell.appendChild(input);
          }
          board.appendChild(cell);
        }),
      );
      for (const dir of ["across", "down"]) {
        const section = make("section");
        section.appendChild(
          make("h4", null, dir === "across" ? "Across →" : "Down ↓"),
        );
        for (const clue of p.clues.filter((c) => c.direction === dir)) {
          const b = make(
            "button",
            "clue-button",
            `${clue.number}. ${clue.clue} (${clue.length})`,
          );
          b.onclick = () => {
            direction = dir;
            (
              wordCells(clue)
                .map((key) => inputs.get(key))
                .find((input) => !input.readOnly) ||
              inputs.get(`${clue.row},${clue.col}`)
            ).focus();
          };
          labels.set(`${clue.number}-${dir}`, b);
          section.appendChild(b);
        }
        clueBox.appendChild(section);
      }
      const scroll = make("div", "crossword-scroll");
      scroll.setAttribute("role", "region");
      scroll.setAttribute(
        "aria-label",
        "Crossword grid. Scroll sideways for a large puzzle.",
      );
      scroll.tabIndex = 0;
      scroll.appendChild(board);
      const scrollWrap = make("div", "grid-scroll-wrap");
      scrollWrap.append(scroll, gridHelp(scroll, board));
      wrap.append(scrollWrap, clueBox);
      if (p.wordBank) {
        const help = make(
          p.showWordBank ? "section" : "details",
          "crossword-help",
        );
        help.appendChild(
          make(
            p.showWordBank ? "h4" : "summary",
            null,
            p.showWordBank
              ? "Words to try with a grown-up"
              : "Need a hand? Show the word bank",
          ),
        );
        const words = make("div", "word-targets");
        for (const word of p.wordBank)
          words.appendChild(make("span", "word-target", word));
        help.appendChild(words);
        container.appendChild(help);
      }
      container.appendChild(wrap);
      answer = () =>
        Object.fromEntries(
          [...inputs].map(([key, input]) => [key, input.value]),
        );
      answer.hint = async () => {
        const clue = selectedClue;
        if (!clue)
          return {
            message: "Tap a square in the answer you want a hint for.",
          };
        if (typeof options.crosswordHint !== "function")
          throw Error("Hints are unavailable right now.");
        const hint = await options.crosswordHint({
          clueNumber: clue.number,
          direction: clue.direction,
          answer: answer(),
        });
        if (hint.complete)
          return { message: "That answer is already complete." };
        const key = `${hint.row},${hint.col}`,
          input = inputs.get(key);
        if (
          !wordCells(clue).includes(key) ||
          !input ||
          input.readOnly ||
          typeof hint.letter !== "string" ||
          !/^[a-z]$/i.test(hint.letter)
        )
          throw Error("Could not apply that hint. Please try again.");
        return {
          target: input.parentElement,
          letter: hint.letter.toUpperCase(),
          clueNumber: clue.number,
          direction: clue.direction,
        };
      };
    } else if (p.type === "wordsearch") {
      const board = make("div", "wordsearch-board");
      board.style.setProperty("--cols", p.grid.length);
      const list = make("div", "word-targets"),
        status = make("p", "status");
      status.setAttribute("role", "status");
      let start = null;
      const found = new Map(),
        buttons = [];
      const wordLabels = new Map();
      for (const word of p.words) {
        const badge = make("span", "word-target", word);
        wordLabels.set(word, badge);
        list.appendChild(badge);
      }
      function choose(r, c) {
        const index = r * p.grid.length + c;
        if (!start) {
          start = [r, c];
          buttons[index].classList.add("letter-start");
          status.textContent = "Now tap the last letter.";
          return;
        }
        const [rr, cc] = start;
        buttons[rr * p.grid.length + cc].classList.remove("letter-start");
        start = null;
        const dr = Math.sign(r - rr),
          dc = Math.sign(c - cc),
          length = Math.max(Math.abs(r - rr), Math.abs(c - cc)) + 1;
        if (
          length < 2 ||
          rr + dr * (length - 1) !== r ||
          cc + dc * (length - 1) !== c
        ) {
          status.textContent = "Choose letters in one straight line.";
          return;
        }
        const cells = Array.from({ length }, (_, i) => [
          rr + dr * i,
          cc + dc * i,
        ]);
        let word = cells.map(([x, y]) => p.grid[x][y]).join("");
        if (!p.words.includes(word)) word = [...word].reverse().join("");
        if (!p.words.includes(word)) {
          status.textContent =
            "Keep looking. That is not one of the listed words.";
          return;
        }
        found.set(word, [rr, cc, r, c]);
        wordLabels.get(word).classList.add("word-found");
        for (const [x, y] of cells)
          buttons[x * p.grid.length + y].classList.add("letter-found");
        status.textContent = `${found.size} of ${p.words.length} words found.`;
      }
      p.grid.forEach((row, r) =>
        row.forEach((letter, c) => {
          const b = make("button", "letter-cell", letter);
          b.setAttribute(
            "aria-label",
            `${letter}, row ${r + 1}, column ${c + 1}`,
          );
          b.onclick = () => choose(r, c);
          buttons.push(b);
          board.appendChild(b);
        }),
      );
      const scroll = make("div", "wordsearch-scroll");
      scroll.setAttribute("role", "region");
      scroll.setAttribute(
        "aria-label",
        "Word search grid. Scroll sideways if needed.",
      );
      scroll.tabIndex = 0;
      scroll.appendChild(board);
      container.append(list, scroll, gridHelp(scroll, board), status);
      answer = () => [...found.values()];
    } else if (p.type === "matching") {
      answer = ExplorerMatching.render(p, container, options);
    } else if (p.type === "tiles") {
      const wrap = make("div", "tile-layout"),
        board = make("div", "tile-board"),
        preview = make("figure", "temple-preview"),
        image = make("img");
      image.src = p.image;
      image.alt = p.imageAlt || "Completed picture guide";
      preview.append(
        image,
        make("figcaption", null, p.imageTitle || "Your picture guide"),
      );
      board.style.setProperty("--cols", p.size);
      let tiles = [...p.tiles],
        selected = null;
      function paint() {
        board.replaceChildren();
        tiles.forEach((tile, i) => {
          const b = make("button", "picture-tile");
          b.style.backgroundImage = `url('${p.image}')`;
          b.style.backgroundSize = `${p.size * 100}% ${p.size * 100}%`;
          b.style.backgroundPosition = `${((tile % p.size) / (p.size - 1)) * 100}% ${(Math.floor(tile / p.size) / (p.size - 1)) * 100}%`;
          b.setAttribute(
            "aria-label",
            `Picture piece ${tile + 1}, position ${i + 1}`,
          );
          b.setAttribute("aria-pressed", String(selected === i));
          b.classList.toggle("tile-selected", selected === i);
          if (p.showNumbers !== false)
            b.appendChild(make("span", "tile-number", tile + 1));
          b.onclick = () => {
            if (selected === null) selected = i;
            else {
              [tiles[selected], tiles[i]] = [tiles[i], tiles[selected]];
              selected = null;
            }
            paint();
          };
          board.appendChild(b);
        });
      }
      paint();
      wrap.append(board, preview);
      container.appendChild(wrap);
      answer = () => [...tiles];
    } else if (p.type === "timeline") {
      const list = make("ol", "timeline-list");
      let events = [...p.events];
      function paint() {
        list.replaceChildren();
        events.forEach((event, i) => {
          const item = make("li", "timeline-event"),
            body = make("span", null, event.text),
            controls = make("div", "timeline-controls");
          for (const [delta, label, symbol] of [
            [-1, "Move earlier", "↑"],
            [1, "Move later", "↓"],
          ]) {
            const b = make("button", null, symbol);
            b.setAttribute("aria-label", `${label}: ${event.text}`);
            b.disabled = i + delta < 0 || i + delta >= events.length;
            b.onclick = () => {
              [events[i], events[i + delta]] = [events[i + delta], events[i]];
              paint();
            };
            controls.appendChild(b);
          }
          item.append(body, controls);
          list.appendChild(item);
        });
      }
      paint();
      container.appendChild(list);
      answer = () => events.map((e) => e.id);
    } else {
      const options = make("fieldset", "quiz-options");
      options.appendChild(make("legend", null, "Choose your answer"));
      let selected = null;
      p.options.forEach((option, i) => {
        const label = make("label", "quiz-option"),
          radio = make("input");
        radio.type = "radio";
        radio.name = "quiz-answer";
        radio.value = String(i);
        radio.onchange = () => (selected = radio.value);
        label.append(radio, make("span", null, option));
        options.appendChild(label);
      });
      container.appendChild(options);
      answer = () => selected;
    }
    if (gridObserver) {
      const dispose = answer.dispose;
      answer.dispose = () => {
        gridObserver.disconnect();
        dispose?.();
      };
    }
    return answer;
  },
};
