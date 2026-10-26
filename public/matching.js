"use strict";
window.ExplorerMatching = {
  render(p, container, { checkMatch } = {}) {
    const make = (tag, cls, value) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (value !== undefined) e.textContent = value;
      return e;
    };
    const board = make("div", "matching-board line-matching"),
      left = make("div", "matching-column"),
      right = make("div", "matching-column"),
      summary = make("p", "status matching-status");
    summary.setAttribute("role", "status");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("matching-lines");
    svg.setAttribute("aria-hidden", "true");
    const leftButtons = new Map(),
      rightButtons = new Map(),
      records = new Map();
    let selected = null,
      drag = null,
      preview = null,
      checking = false,
      locked = false,
      disposed = false,
      suppressUntil = 0;
    function line(from, to, state) {
      const path = document.createElementNS(svg.namespaceURI, "path"),
        bend = Math.max(25, (to.x - from.x) * 0.45);
      path.setAttribute(
        "d",
        `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`,
      );
      path.setAttribute("class", "connection-line connection-" + state);
      svg.appendChild(path);
      for (const point of [from, to]) {
        const dot = document.createElementNS(svg.namespaceURI, "circle");
        dot.setAttribute("cx", point.x);
        dot.setAttribute("cy", point.y);
        dot.setAttribute("r", "5");
        dot.setAttribute("class", "connection-dot connection-" + state);
        svg.appendChild(dot);
      }
    }
    function draw() {
      if (disposed) return;
      const area = board.getBoundingClientRect();
      if (!area.width || !area.height) return;
      svg.setAttribute("viewBox", `0 0 ${area.width} ${area.height}`);
      svg.replaceChildren();
      const anchor = (button, side) => {
        const bounds = button.getBoundingClientRect();
        return {
          x: (side === "left" ? bounds.right : bounds.left) - area.left,
          y: bounds.top + bounds.height / 2 - area.top,
        };
      };
      for (const [id, record] of records)
        line(
          anchor(leftButtons.get(id), "left"),
          anchor(rightButtons.get(record.right), "right"),
          record.state,
        );
      if (preview && selected)
        line(
          anchor(leftButtons.get(selected), "left"),
          { x: preview.x - area.left, y: preview.y - area.top },
          "pending",
        );
    }
    function paint() {
      for (const [id, b] of leftButtons) {
        const state = records.get(id)?.state;
        b.classList.toggle("match-selected", id === selected);
        b.classList.toggle("match-correct", state === "correct");
        b.classList.toggle("match-wrong", state === "wrong");
        b.disabled = locked || checking || state === "correct";
        b.setAttribute("aria-pressed", String(id === selected));
        b.setAttribute(
          "aria-label",
          p.left.find((v) => v.id === id).text +
            (state === "correct"
              ? " — correct match"
              : state === "wrong"
                ? " — try another meaning"
                : ""),
        );
      }
      for (const [id, b] of rightButtons) {
        const record = [...records.values()].find((v) => v.right === id);
        b.classList.toggle("match-correct", record?.state === "correct");
        b.classList.toggle("match-wrong", record?.state === "wrong");
        b.disabled = locked || checking || record?.state === "correct";
      }
      board.setAttribute("aria-busy", String(checking));
      draw();
    }
    async function connect(id, target) {
      if (
        disposed ||
        locked ||
        checking ||
        records.get(id)?.state === "correct"
      )
        return;
      if (
        [...records.values()].some(
          (v) => v.right === target && v.state === "correct",
        )
      ) {
        summary.textContent =
          "That meaning already has its correct match. Try another.";
        return;
      }
      for (const [key, record] of records)
        if (record.right === target && key !== id) records.delete(key);
      selected = null;
      preview = null;
      checking = true;
      records.set(id, { right: target, state: "pending" });
      summary.textContent = "Checking your connection…";
      paint();
      try {
        const result = await checkMatch(id, target);
        if (disposed || locked) return;
        records.set(id, {
          right: target,
          state: result.correct ? "correct" : "wrong",
        });
        const count = [...records.values()].filter(
          (v) => v.state === "correct",
        ).length;
        summary.textContent = result.correct
          ? `✓ Correct! ${count} of ${p.left.length} pairs matched.${count === p.left.length ? " Check your work to finish the level." : ""}`
          : "Try again. That red line connects a word to the wrong meaning.";
        if (result.correct)
          window.ExplorerCelebration?.burst(rightButtons.get(target), "match");
      } catch (error) {
        if (disposed) return;
        records.delete(id);
        summary.textContent =
          error.message || "Connection could not be checked. Try again.";
      } finally {
        checking = false;
        if (!disposed) paint();
      }
    }
    for (const item of p.left) {
      const b = make("button", "match-item match-left", item.text);
      b.dataset.id = item.id;
      b.dataset.side = "left";
      b.onclick = () => {
        if (
          performance.now() < suppressUntil ||
          locked ||
          checking ||
          b.disabled
        )
          return;
        selected = item.id;
        summary.textContent =
          "Now choose a meaning on the right, or drag a line to it.";
        paint();
      };
      b.onpointerdown = (e) => {
        if (e.button !== 0 || locked || checking || b.disabled) return;
        selected = item.id;
        drag = {
          id: item.id,
          pointer: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
        };
        b.setPointerCapture(e.pointerId);
        paint();
      };
      b.onpointermove = (e) => {
        if (!drag || drag.id !== item.id || drag.pointer !== e.pointerId)
          return;
        if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6)
          drag.moved = true;
        if (drag.moved) {
          preview = { x: e.clientX, y: e.clientY };
          draw();
        }
      };
      b.onpointerup = (e) => {
        if (!drag || drag.pointer !== e.pointerId) return;
        const wasDrag = drag.moved;
        drag = null;
        preview = null;
        if (b.hasPointerCapture(e.pointerId))
          b.releasePointerCapture(e.pointerId);
        if (wasDrag) {
          suppressUntil = performance.now() + 400;
          const target = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest(".match-right");
          if (target && board.contains(target) && !target.disabled)
            connect(item.id, target.dataset.id);
          else {
            summary.textContent =
              "End your line on a meaning in the right column.";
            paint();
          }
        } else paint();
      };
      b.onpointercancel = () => {
        drag = null;
        preview = null;
        paint();
      };
      leftButtons.set(item.id, b);
      left.appendChild(b);
    }
    for (const item of p.right) {
      const b = make("button", "match-item match-right", item.text);
      b.dataset.id = item.id;
      b.dataset.side = "right";
      b.onclick = () => {
        if (!selected) {
          summary.textContent = "Choose a word from the left first.";
          return;
        }
        connect(selected, item.id);
      };
      rightButtons.set(item.id, b);
      right.appendChild(b);
    }
    board.append(svg, left, right);
    container.append(board, summary);
    summary.textContent =
      "Draw a line, or tap a word and its meaning. Blue ✓ means correct; red means try again.";
    const observer = new ResizeObserver(draw);
    observer.observe(board);
    requestAnimationFrame(paint);
    const answer = () =>
      Object.fromEntries(
        [...records].map(([id, record]) => [id, record.right]),
      );
    answer.ready = () => !checking;
    answer.lock = () => {
      locked = true;
      selected = null;
      preview = null;
      drag = null;
      paint();
    };
    answer.dispose = () => {
      disposed = true;
      observer.disconnect();
      drag = null;
    };
    return answer;
  },
};
