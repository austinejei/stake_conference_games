"use strict";
const sessions = [
  {
    id: "leadership",
    name: "Stake & Ward Leadership",
    start: "2026-10-31T11:00:00Z",
    end: "2026-10-31T13:00:00Z",
    time: "Saturday · 11am–1pm",
    headline: "Lead with love.",
    prompt: "Listen for one way you can care for someone in your ward.",
    topics: [
      "Service",
      "Ministering",
      "Unity",
      "Jesus Christ",
      "Leadership",
      "Love",
    ],
  },
  {
    id: "adult",
    name: "Adult Session",
    start: "2026-10-31T13:30:00Z",
    end: "2026-10-31T15:30:00Z",
    time: "Saturday · 1:30–3:30pm",
    headline: "Faith grows in everyday moments.",
    prompt:
      "Listen for a teaching you can put into practice at home this week.",
    topics: ["Faith", "Family", "Covenants", "Prayer", "Hope", "Jesus Christ"],
  },
  {
    id: "general",
    name: "Sunday General Session",
    start: "2026-11-01T10:00:00Z",
    end: "2026-11-01T12:00:00Z",
    time: "Sunday · 10am–noon",
    headline: "Listen. Notice. Remember.",
    prompt:
      "Listen with your family. Notice a gospel word, then think about what it means to you.",
    topics: ["Jesus Christ", "Faith", "Prayer", "Love", "Service", "Temple"],
  },
];
function conferenceState(now = Date.now(), override = "auto") {
  const active =
    override === "auto"
      ? sessions.find(
          (s) => now >= Date.parse(s.start) && now < Date.parse(s.end),
        )
      : sessions.find((s) => s.id === override);
  const next = sessions.find((s) => Date.parse(s.start) > now);
  const mode = override === "free" ? "free" : active?.id || "free";
  return {
    mode,
    quiet: mode === "general",
    active: active || null,
    next: next || null,
    sessions,
    timeZone: "Africa/Accra",
    serverTime: new Date(now).toISOString(),
    override,
  };
}
module.exports = { sessions, conferenceState };
