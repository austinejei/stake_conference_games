"use strict";
const $ = (id) => document.getElementById(id);
let player = null,
  selected = null,
  current = null,
  conference = null,
  activeTab = "games",
  recovery = "",
  sessionPending = false;
let disposeGame = () => {};
const names = {
  crossword: ["🔡", "Gospel Crossword"],
  wordhunt: ["🔎", "Scripture Word Hunt"],
  heroes: ["📖", "Scripture Heroes"],
  matching: ["🧩", "Match the Teaching"],
  temple: ["🏛️", "Gospel Picture Puzzle"],
  history: ["🗺️", "Scripture & History Trail"],
};
async function api(url, method = "GET", body) {
  const r = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) {
    const error = Error(d.error || "Request failed");
    error.data = d;
    throw error;
  }
  return d;
}
function text(node, value) {
  node.textContent = String(value);
}
function make(tag, cls, value) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (value !== undefined) text(e, value);
  return e;
}
function note(msg, id = "cloudStatus") {
  text($(id), msg);
}
function showTab(id) {
  if (conference?.quiet && ["games", "rank"].includes(id)) id = "listen";
  activeTab = id;
  document.querySelectorAll("nav button").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === id);
    b.setAttribute("aria-pressed", String(b.dataset.tab === id));
  });
  document.querySelectorAll(".panel").forEach((e) => (e.hidden = e.id !== id));
  if (id === "listen") renderListening();
  if (id === "cloud") loadCloud();
  if (id === "rank") loadRank();
}
document
  .querySelectorAll("nav button")
  .forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
function signedIn(d) {
  player = d.player;
  ExplorerAnnouncements.refresh();
  $("registration").hidden = true;
  $("dashboard").hidden = false;
  renderPlayer();
  renderListening();
  showTab(conference?.active ? "listen" : "games");
  refreshPresence();
  if (d.recoveryCode) showRecovery(d.recoveryCode);
}
$("joinForm").onsubmit = async (e) => {
  e.preventDefault();
  $("join").disabled = true;
  try {
    signedIn(
      await api("/api/register", "POST", {
        nickname: $("nickname").value,
        age: $("age").value,
        ward: $("ward").value,
        acknowledged: $("acknowledged").checked,
      }),
    );
  } catch (error) {
    note(error.message, "joinStatus");
  } finally {
    $("join").disabled = false;
  }
};
$("recoverForm").onsubmit = async (e) => {
  e.preventDefault();
  $("recoverButton").disabled = true;
  try {
    signedIn(
      await api("/api/recover", "POST", { code: $("recoveryInput").value }),
    );
    $("recoveryInput").value = "";
  } catch (error) {
    note(error.message, "recoverStatus");
  } finally {
    $("recoverButton").disabled = false;
  }
};
function showRecovery(code) {
  text($("copyRecovery"), "Copy code");
  text($("copyRecoveryStatus"), "");
  recovery = code;
  text($("recoveryCode"), code);
  $("recoveryNotice").hidden = false;
  $("recoveryNotice").scrollIntoView({ behavior: "smooth", block: "center" });
}
$("dismissRecovery").onclick = () => {
  $("recoveryNotice").hidden = true;
  recovery = "";
  text($("recoveryCode"), "");
};
$("copyRecovery").onclick = async () => {
  if (!recovery) return;
  try {
    await navigator.clipboard.writeText(recovery);
    text($("copyRecovery"), "✓ Copied");
    text(
      $("copyRecoveryStatus"),
      "Copied. Keep your recovery code somewhere private.",
    );
  } catch {
    const selection = window.getSelection(),
      range = document.createRange();
    range.selectNodeContents($("recoveryCode"));
    selection.removeAllRanges();
    selection.addRange(range);
    text(
      $("copyRecoveryStatus"),
      "Automatic copy is unavailable. Your code is selected; use Copy or Ctrl+C.",
    );
  }
};
$("replaceRecovery").onclick = async () => {
  try {
    const d = await api("/api/recovery-code", "POST", {});
    showRecovery(d.recoveryCode);
    note("Your previous recovery code has been replaced.", "accountStatus");
  } catch (e) {
    note(e.message, "accountStatus");
  }
};
function signedOut() {
  ExplorerAnnouncements.reset();
  ExplorerSharing.clear();
  disposeGame();
  cloudLoadSequence++;
  ExplorerListening.clearForPlayer(player?.id);
  player = null;
  current = null;
  recovery = "";
  $("dashboard").hidden = true;
  $("registration").hidden = false;
  $("recoveryNotice").hidden = true;
  text($("recoveryCode"), "");
  $("challenge").replaceChildren();
  $("challenge").hidden = true;
  $("reflection").value = "";
  text($("reflectionResult"), "");
  $("deleteConfirm").value = "";
  $("joinForm").reset();
  $("wordReceipt").hidden = true;
  $("newWord").value = "";
  $("cloudWords").replaceChildren();
  $("selectedWord").hidden = true;
  note("");
  refreshPresence();
  renderListening();
}
$("logout").onclick = async () => {
  try {
    await api("/api/logout", "POST", {});
    signedOut();
  } catch (e) {
    note(e.message, "accountStatus");
  }
};
$("deleteForm").onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api("/api/account", "DELETE", { confirm: $("deleteConfirm").value });
    signedOut();
    note(
      "Your account and participation data have been deleted.",
      "joinStatus",
    );
  } catch (error) {
    note(error.message, "accountStatus");
  }
};
function renderPlayer() {
  text($("greeting"), "Hello, " + player.nickname + "!");
  text($("profile"), `Gospel Explorer · Ages ${player.age} · ${player.ward}`);
  text(
    $("publicAlias"),
    `Your public leaderboard alias is ${player.publicName}. Your nickname is private to you and moderators reviewing your submissions.`,
  );
  text($("points"), player.points);
  const done = Object.values(player.progress).reduce((a, b) => a + b, 0);
  $("progressbar").style.width = Math.round((done / 90) * 100) + "%";
  $("progressbar").parentElement.setAttribute("aria-valuenow", done);
  text($("progressText"), `${done} of 90 game levels completed`);
  const cards = $("gameCards");
  cards.replaceChildren();
  for (const [id, [emoji, name]] of Object.entries(names)) {
    const b = make("button", "game-card game-" + id);
    const icon = make("span", null, emoji);
    icon.setAttribute("aria-hidden", "true");
    b.append(
      icon,
      make("b", null, name),
      make(
        "small",
        null,
        `${player.progress[id]}/15 levels · ${player.progress[id] === 15 ? "Completed" : "Tap to explore"}`,
      ),
    );
    b.onclick = () => openGame(id);
    cards.appendChild(b);
  }
  const listen = make("button", "game-card");
  listen.append(
    make("span", null, "👂"),
    make("b", null, "Listening Mission"),
    make("small", null, "A quiet moment · No points"),
  );
  listen.onclick = () => showTab("listen");
  cards.appendChild(listen);
}
async function openGame(game) {
  disposeGame();
  disposeGame = () => {};
  if (conference?.quiet) {
    showTab("listen");
    return;
  }
  const box = $("challenge");
  box.hidden = false;
  box.replaceChildren(make("p", "status", "Getting your challenge ready…"));
  try {
    const d = await api("/api/challenge?game=" + encodeURIComponent(game));
    current = { ...d, game };
    box.replaceChildren();
    const top = make("div", "row between"),
      title = make(
        "h3",
        null,
        d.complete ? "Trail complete!" : `${names[game][1]} · Level ${d.level}`,
      ),
      close = make("button", null, "Close");
    close.onclick = () => {
      disposeGame();
      current = null;
      box.hidden = true;
      box.replaceChildren();
    };
    if (game === "crossword" && !d.complete) {
      const info = make("div", "crossword-mobile-info"),
        infoButton = make("button", "tooltip-info-icon", "i");
      let hintPopover = null,
        hintedCell = null;
      const clearHint = () => {
        hintedCell?.classList.remove("crossword-hint-target");
        hintedCell?.querySelector("input")?.removeAttribute("aria-describedby");
        hintedCell = null;
        hintPopover?.remove();
        hintPopover = null;
      };
      const showHint = (hint) => {
        clearHint();
        hintedCell = hint.target;
        hintedCell.classList.add("crossword-hint-target");
        hintedCell.querySelector("input")?.setAttribute(
          "aria-describedby",
          "crosswordHintPopover",
        );
        hintPopover = make(
          "div",
          "crossword-hint-popover",
          `${hint.clueNumber} ${hint.direction}: this square is ${hint.letter}.`,
        );
        hintPopover.id = "crosswordHintPopover";
        hintPopover.setAttribute("role", "status");
        hintPopover.setAttribute("aria-live", "polite");
        document.body.appendChild(hintPopover);
        const rect = hintedCell.getBoundingClientRect(),
          width = Math.min(280, window.innerWidth - 24);
        hintPopover.style.width = `${width}px`;
        const height = hintPopover.offsetHeight,
          left = Math.max(
            12,
            Math.min(rect.left, window.innerWidth - width - 12),
          ),
          top =
            rect.bottom + height + 12 <= window.innerHeight
              ? rect.bottom + 8
              : Math.max(12, rect.top - height - 8);
        hintPopover.style.left = `${left}px`;
        hintPopover.style.top = `${top}px`;
      };
      infoButton.type = "button";
      infoButton.setAttribute("aria-label", "Show a letter hint");
      infoButton.title =
        "Show one correct letter beside its crossword square; it will not be entered for you.";
      infoButton.onclick = async () => {
        infoButton.disabled = true;
        try {
          const hint = await answer.hint();
          if (hint.target) showHint(hint);
          else text(status, hint.message);
        } catch (error) {
          text(status, error.message);
        } finally {
          infoButton.disabled = false;
        }
      };
      info.append(infoButton);
      const actions = make("div", "crossword-header-actions");
      actions.append(info, close);
      top.append(title, actions);
    } else {
      top.append(title, close);
    }
    box.appendChild(top);
    if (d.complete) {
      box.appendChild(
        make(
          "p",
          null,
          "You finished all 15 levels on this trail. Try another adventure!",
        ),
      );
      return;
    }
    box.appendChild(make("p", "game-instructions", d.question));
    const board = make("div", "game-board");
    box.appendChild(board);
    const answer = ExplorerGames.render(d, board, {
        crosswordHint: ({ clueNumber, direction, answer }) =>
          api("/api/crossword/hint", "POST", {
            level: d.level,
            clueNumber,
            direction,
            answer,
          }),
        checkMatch: (left, right) =>
          api("/api/match/check", "POST", { level: d.level, left, right }),
      }),
      controls = make("div", "game-actions"),
      submit = make("button", "primary", "Check my work"),
      status = make("p", "status");
    status.setAttribute("role", "status");
    disposeGame = () => answer.dispose?.();
    controls.append(submit, status);
    box.appendChild(controls);

    
    // --- CROSSWORD MOBILE CLUE TOOLTIP ---
    // --- CROSSWORD MOBILE TOOLTIP ---
    if (game === "crossword") {
      // Append directly to the body so 'position: fixed' works perfectly
      let tooltip = document.getElementById("mobileTooltip");
      if (!tooltip) {
        tooltip = make("div", "mobile-clue-tooltip");
        tooltip.id = "mobileTooltip";
        document.body.appendChild(tooltip);
      }

      board.addEventListener("focusin", (e) => {
        if (e.target.tagName !== "INPUT") return;
        clearHint();
        
        const match = (e.target.name || e.target.id || "").match(/(\d+),(\d+)/);
        if (!match) return;
        
        const r = parseInt(match[1], 10);
        const c = parseInt(match[2], 10);
        
        const activeClues = d.clues.filter(clue => {
          if (clue.direction === "across") return r === clue.row && c >= clue.col && c < clue.col + clue.length;
          if (clue.direction === "down") return c === clue.col && r >= clue.row && r < clue.row + clue.length;
          return false;
        });

        if (activeClues.length > 0) {
          const cluesText = activeClues.map(cl => 
            `<strong>${cl.number}${cl.direction === 'across' ? 'A' : 'D'}:</strong> ${cl.clue}`
          ).join("<br>");
          
          tooltip.innerHTML = `<div class="tooltip-info-icon">i</div> <div>${cluesText}</div>`;
        }
      });

      board.addEventListener("focusout", () => {
        setTimeout(() => {
          if (!board.querySelector("input:focus")) tooltip.innerHTML = "";
        }, 100);
      });

      // Clear the tooltip when the game is closed
      const oldDispose = disposeGame;
      disposeGame = () => {
        if (tooltip) tooltip.innerHTML = "";
        clearHint();
        oldDispose?.();
      };
    }

    submit.onclick = async () => {
      if (answer.ready && !answer.ready()) {
        text(status, "Let this connection finish checking, then try again.");
        return;
      }
      submit.disabled = true;
      try {
        const a = await api("/api/answer", "POST", {
          game,
          level: d.level,
          answer: answer(),
        });
        player = a.player;
        text(
          status,
          a.correct
            ? "Well done! Your points are saved."
            : "Not quite yet. Take another look and try again.",
        );
        if (a.correct) {
          answer.lock?.();
          ExplorerCelebration.burst(submit, "level");
          renderPlayer();
          board
            .querySelectorAll("button,input")
            .forEach((e) => (e.disabled = true));
          if (d.reference)
            box.appendChild(
              make("p", "muted", "Explore the scripture: " + d.reference),
            );
          const next = make(
            "button",
            "primary",
            d.level === 15 ? "Finish trail" : "Next challenge →",
          );
          next.onclick = () => openGame(game);
          controls.replaceChild(next, submit);
          const rest = make("button", null, "Take a listening break");
          rest.onclick = () => {
            box.hidden = true;
            showTab("listen");
            renderListening();
          };
          controls.appendChild(rest);
        } else submit.disabled = false;
      } catch (e) {
        text(status, e.message);
        submit.disabled = false;
        refreshConference();
      }
    };
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    box.replaceChildren(make("p", "status", e.message));
    refreshConference();
  }
}
function renderListening() {
  ExplorerListening.render({ player, conference });
  $("returnToGames").hidden = !!conference?.quiet;
  text($("returnToGames"), current ? "Back to my game" : "Explore the games");
}
$("returnToGames").onclick = () => {
  showTab("games");
  if (current) {
    $("challenge").hidden = false;
    $("challenge").scrollIntoView({ behavior: "smooth", block: "start" });
  }
};
$("goListen").onclick = () => showTab("listen");
function renderConference(d) {
  const changed = conference?.mode !== d.mode;
  conference = d;
  const active = d.active;
  document.body.classList.toggle("quiet-mode", d.quiet);
  text(
    $("sessionBadge"),
    active ? "NOW · " + active.name.toUpperCase() : "CONFERENCE WEEKEND",
  );
  text(
    $("sessionTitle"),
    active?.headline ||
      (d.next
        ? "Get ready for " + d.next.name + "."
        : "Keep exploring. Keep growing."),
  );
  text(
    $("sessionPrompt"),
    active?.prompt ||
      (d.next
        ? "Games are open. When a session begins, your listening prompts will adapt automatically."
        : "Take what you learned into your week. Games and reflections remain available."),
  );
  text($("sessionTime"), "Ghana time · GMT");
  const schedule = $("sessionSchedule");
  schedule.replaceChildren();
  for (const session of d.sessions) {
    const item = make(
      "div",
      "schedule-item" + (active?.id === session.id ? " schedule-active" : ""),
    );
    item.append(
      make("b", null, session.name),
      make("span", null, session.time),
    );
    if (active?.id === session.id)
      item.appendChild(make("small", null, "In session"));
    schedule.appendChild(item);
  }
  $("gameLibrary").hidden = d.quiet;
  $("quietGames").hidden = !d.quiet;
  for (const b of document.querySelectorAll("nav button"))
    if (["games", "rank"].includes(b.dataset.tab)) {
      b.disabled = d.quiet;
      b.title = d.quiet ? "Returns after the general session" : "";
    }
  if (changed) {
    renderListening();
    if (d.quiet) {
      disposeGame();
      current = null;
      $("challenge").hidden = true;
      $("challenge").replaceChildren();
      if (player) showTab("listen");
    }
  }
}
async function refreshConference() {
  if (sessionPending || document.hidden) return;
  sessionPending = true;
  try {
    renderConference(await api("/api/conference"));
  } catch {
    note(
      "Session updates are temporarily unavailable. Reconnecting…",
      "sessionPrompt",
    );
  } finally {
    sessionPending = false;
  }
}
const pendingWordActions = new Set();
let cloudLoadSequence = 0;
async function loadCloud() {
  const sequence = ++cloudLoadSequence;
  try {
    const d = await api("/api/words");
    if (sequence !== cloudLoadSequence) return;
    const box = $("cloudWords");
    box.replaceChildren();
    for (const w of d.words) {
      const b = make("button", w.appreciated ? "word-appreciated" : "", w.text);
      b.style.fontSize = 15 + Math.min(w.likes, 25) * 0.8 + "px";
      b.title = `${w.likes} appreciations${w.appreciated ? " · You appreciated this" : ""}`;
      b.onclick = () => selectWord(w);
      box.appendChild(b);
    }
    if (selected && !$("selectedWord").hidden) {
      const fresh = d.words.find((w) => w.id === selected.id);
      if (fresh) selectWord(fresh);
      else {
        $("selectedWord").hidden = true;
        selected = null;
      }
    }
  } catch (e) {
    note(e.message);
  }
}
function selectWord(w) {
  selected = w;
  const box = $("selectedWord");
  box.hidden = false;
  box.replaceChildren(make("h3", null, `${w.text} · ${w.likes} appreciations`));
  for (const [label, doneLabel, action, flag] of [
    ["❤️ This inspired me", "✓ Appreciated", "like", "appreciated"],
    ["🚩 Report concern", "✓ Report sent", "report", "reported"],
  ]) {
    const key = `${w.id}:${action}`,
      b = make(
        "button",
        w[flag] ? "word-action-done" : "",
        w[flag] ? doneLabel : label,
      );
    b.disabled = !!w[flag] || pendingWordActions.has(key);
    b.onclick = async () => {
      if (w[flag] || pendingWordActions.has(key)) return;
      pendingWordActions.add(key);
      b.disabled = true;
      try {
        const r = await api(`/api/words/${w.id}/${action}`, "POST", {});
        Object.assign(w, r.word);
        note(r.message);
      } catch (e) {
        if (e.data?.word) Object.assign(w, e.data.word);
        note(e.message);
      } finally {
        pendingWordActions.delete(key);
        if (selected?.id === w.id) {
          if (w.status === "approved") selectWord(w);
          else {
            box.hidden = true;
            selected = null;
          }
        }
        loadCloud();
      }
    };
    box.appendChild(b);
  }
}
$("wordForm").onsubmit = async (event) => {
  event.preventDefault();
  const word = $("newWord").value.trim();
  if (!word) {
    note("Enter a gospel word or short phrase first.");
    $("newWord").focus();
    return;
  }
  $("submitWord").disabled = true;
  $("wordReceipt").hidden = true;
  note("");
  try {
    const r = await api("/api/words", "POST", { text: word });
    $("newWord").value = "";
    text(
      $("wordReceiptTitle"),
      r.status === "approved" ? "Already in the cloud" : "✓ Sent for review",
    );
    text(
      $("wordReceiptMessage"),
      r.status === "approved"
        ? r.message
        : `“${r.submittedText || word}” — ${r.message.replace(/^Sent for review\.\s*/, "")}`,
    );
    $("wordReceipt").hidden = false;
    $("wordReceipt").focus();
    loadCloud();
  } catch (e) {
    note(e.message);
  } finally {
    $("submitWord").disabled = false;
  }
};
$("newWord").onkeydown = (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    $("wordForm").requestSubmit();
  }
};
async function loadRank() {
  try {
    const d = await api(
      "/api/leaderboard?age=" + encodeURIComponent(player.age),
    );
    for (const [id, items, format] of [
      ["playerRanks", d.players, (p) => `${p.nickname} (${p.ward}) — ${p.points} pts`],
      [
        "wardRanks",
        d.wards,
        (w) => `${w.ward} — ${w.average} avg. (${w.players} players)`,
      ],
    ]) {
      const box = $(id);
      box.replaceChildren();
      if (!items.length) {
        text(box, "Your story starts here. No rankings yet.");
        continue;
      }
      items.forEach((item, i) =>
        box.appendChild(make("div", "rank", `${i + 1}. ${format(item)}`)),
      );
    }
  } catch (e) {
    text($("playerRanks"), e.message);
  }
}
let presencePending = false;
async function refreshPresence() {
  if (document.hidden || presencePending) return;
  presencePending = true;
  try {
    const d = await api("/api/presence", player ? "POST" : "GET");
    text(
      $("onlineCount"),
      d.online === 0
        ? "Be the first explorer online!"
        : `${d.online} ${d.online === 1 ? "explorer" : "explorers"} online`,
    );
    $("onlineCount").parentElement.classList.remove("is-offline");
  } catch {
    text($("onlineCount"), "Live count unavailable");
    $("onlineCount").parentElement.classList.add("is-offline");
  } finally {
    presencePending = false;
  }
}
setInterval(() => {
  refreshPresence();
  refreshConference();
  if (player && activeTab === "cloud") loadCloud();
}, 20000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshPresence();
    refreshConference();
  }
});
window.addEventListener("online", () => {
  refreshPresence();
  refreshConference();
});
(async () => {
  try {
    const config = await api("/api/config");
    for (const ward of config.wards) {
      const o = make("option", null, ward);
      o.value = ward;
      $("ward").appendChild(o);
    }
    renderConference(config.conference);
  } catch {
    note(
      "Unable to load conference details. Please refresh when connected.",
      "joinStatus",
    );
  }
  try {
    signedIn(await api("/api/me"));
  } catch {}
  refreshPresence();
  renderListening();
})();
