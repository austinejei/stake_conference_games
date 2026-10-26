"use strict";
window.ExplorerAdminAnnouncements = (() => {
  const $ = (id) => document.getElementById(id);
  let state = null,
    selected = new Set(),
    draft = null;
  function node(tag, value, cls) {
    const e = document.createElement(tag);
    if (value !== undefined) e.textContent = value;
    if (cls) e.className = cls;
    return e;
  }
  function status(message) {
    $("announcementAdminStatus").textContent = message;
  }
  async function api(url, method = "GET", body) {
    const r = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      }),
      d = await r.json();
    if (!r.ok) throw Error(d.error || "Request failed");
    return d;
  }
  function invalidate() {
    draft = null;
    $("announcementPreview").hidden = true;
  }
  function audienceText(target) {
    if (target.type === "all")
      return "Everyone, including people who join later and visitors who have not joined.";
    if (target.type === "accounts")
      return (
        `${target.values.length} selected account(s): ` +
        target.values
          .map((id) => {
            const p = state.accounts.find((p) => p.id === id);
            return p
              ? `${p.nickname} (${p.publicName})`
              : "Account no longer available";
          })
          .join(", ")
      );
    return `${target.type === "ages" ? "Age groups" : "Wards"}: ${target.values.join(", ")}. Includes matching accounts that join later.`;
  }
  function choices() {
    if (!state) return;
    const type = $("announcementAudience").value;
    $("announcementTargetArea").hidden = type === "all";
    $("announcementSearchLabel").hidden = type !== "accounts";
    const box = $("announcementRecipients");
    box.replaceChildren();
    const query = $("announcementAccountSearch").value.toLowerCase();
    const options =
      type === "accounts"
        ? state.accounts
            .filter((p) =>
              [p.nickname, p.publicName, p.age, p.ward].some((v) =>
                String(v).toLowerCase().includes(query),
              ),
            )
            .slice(0, 100)
            .map((p) => [
              p.id,
              `${p.nickname} · ${p.publicName} · ${p.age} · ${p.ward}`,
            ])
        : type === "ages"
          ? state.ages.map((v) => [v, v === "12+" ? "12+ (older accounts)" : v])
          : type === "wards"
            ? state.wards.map((v) => [
                v,
                v === "Visitor" ? "Visitor / ward not provided" : v,
              ])
            : [];
    for (const [value, label] of options) {
      const row = node("label", undefined, "announcement-choice"),
        checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = value;
      checkbox.checked = selected.has(value);
      checkbox.onchange = () => {
        if (checkbox.checked) selected.add(value);
        else selected.delete(value);
        invalidate();
        summary();
      };
      row.append(checkbox, node("span", label));
      box.appendChild(row);
    }
    if (type === "accounts" && !options.length)
      box.appendChild(node("p", "No accounts match your search.", "muted"));
    summary();
  }
  function summary() {
    const target = {
      type: $("announcementAudience").value,
      values: [...selected],
    };
    $("announcementAudienceSummary").textContent =
      target.type === "accounts"
        ? `${selected.size} account(s) selected. Search changes do not remove your selections.`
        : audienceText(target);
  }
  function renderList() {
    for (const [id, cleared] of [
      ["activeAnnouncements", false],
      ["clearedAnnouncements", true],
    ]) {
      const box = $(id);
      box.replaceChildren();
      const items = state.announcements.filter(
        (m) => !!m.clearedAt === cleared,
      );
      if (!items.length) {
        box.appendChild(
          node(
            "p",
            cleared ? "No cleared announcements." : "No active announcements.",
            "muted",
          ),
        );
        continue;
      }
      for (const m of items) {
        const article = node(
          "article",
          undefined,
          "announcement-admin-message",
        );
        article.append(
          node("h4", m.title),
          node("p", m.body, "announcement-body"),
          node("p", audienceText(m.target), "muted"),
          node(
            "p",
            `${cleared ? "Cleared" : "Active"} · Displayed to ${m.displayedCount} account(s) · ${new Date(m.createdAt).toLocaleString("en-GB", { timeZone: "Africa/Accra" })} GMT`,
            "muted",
          ),
        );
        if (!cleared) {
          const b = node("button", "Clear announcement");
          b.onclick = async () => {
            b.disabled = true;
            try {
              await api(
                "/api/admin/announcements/" + m.id + "/clear",
                "POST",
                {},
              );
              status(
                "Announcement cleared. Recipients will resume when their app receives the update.",
              );
              await load();
            } catch (e) {
              status(e.message);
              b.disabled = false;
            }
          };
          article.appendChild(b);
        }
        box.appendChild(article);
      }
    }
  }
  async function load() {
    try {
      state = await api("/api/admin/announcements");
      choices();
      renderList();
    } catch (e) {
      status(e.message);
    }
  }
  function clear() {
    state = null;
    selected.clear();
    invalidate();
    $("announcementForm").reset();
    $("activeAnnouncements").replaceChildren();
    $("clearedAnnouncements").replaceChildren();
    $("announcementRecipients").replaceChildren();
    status("");
  }
  $("announcementAudience").onchange = () => {
    selected.clear();
    invalidate();
    choices();
  };
  $("announcementAccountSearch").oninput = choices;
  for (const id of ["announcementTitle", "announcementBody"])
    $(id).oninput = invalidate;
  $("previewAnnouncement").onclick = () => {
    if (!$("announcementForm").reportValidity()) return;
    const type = $("announcementAudience").value;
    if (type !== "all" && !selected.size) {
      status("Select at least one recipient.");
      return;
    }
    draft = {
      title: $("announcementTitle").value.trim(),
      body: $("announcementBody").value.trim(),
      target: { type, values: [...selected] },
    };
    $("announcementPreviewTitle").textContent = draft.title;
    $("announcementPreviewBody").textContent = draft.body;
    $("announcementPreviewAudience").textContent = audienceText(draft.target);
    $("announcementPreview").hidden = false;
    status("Check the message and audience. Nothing has been sent yet.");
  };
  $("announcementForm").onsubmit = async (event) => {
    event.preventDefault();
    if (!draft) {
      status("Preview this announcement before sending.");
      return;
    }
    $("sendAnnouncement").disabled = true;
    try {
      await api("/api/admin/announcements", "POST", draft);
      status("Announcement sent. It stays active until you clear it.");
      invalidate();
      $("announcementTitle").value = "";
      $("announcementBody").value = "";
      await load();
    } catch (e) {
      status(e.message);
    } finally {
      $("sendAnnouncement").disabled = false;
    }
  };
  $("refreshAnnouncements").onclick = load;
  return { load, clear };
})();
