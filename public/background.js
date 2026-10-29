"use strict";
(() => {
  const sky = document.getElementById("gospelSky");
  if (!sky) return;
  // Living leaders checked against the October 2026 sustaining presentation.
  // https://www.churchofjesuschrist.org/study/general-conference/2026/10/11christofferson?lang=eng
  const tokens = [
    ["word", "Faith"],
    ["icon", "temple"],
    ["name", "Nephi"],
    ["word", "Hope"],
    ["icon", "scriptures"],
    ["name", "Esther"],
    ["name", "Dallin H. Oaks"],
    ["word", "Love"],
    ["icon", "moroni"],
    ["name", "Ruth"],
    ["name", "Henry B. Eyring"],
    ["word", "Serve"],
    ["icon", "temple"],
    ["name", "Noah"],
    ["name", "D. Todd Christofferson"],
    ["word", "Joy"],
    ["icon", "scriptures"],
    ["name", "Daniel"],
  ];
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  tokens.forEach(([kind, value], i) => {
    const e = document.createElement("span");
    e.className = "sky-token sky-" + kind;
    e.style.setProperty("--x", ((i * 37 + 7) % 96) + "%");
    e.style.setProperty("--duration", 32 + (i % 6) * 5 + "s");
    e.style.setProperty("--delay", -i * 7 + "s");
    e.style.setProperty("--tilt", (i % 2 ? -8 : 9) + "deg");
    if (kind === "icon") {
      const image = document.createElement("img");
      image.src = "/decor/" + value + ".svg";
      image.alt = "";
      image.width = 72;
      image.height = 72;
      image.decoding = "async";
      e.appendChild(image);
    } else e.textContent = value;
    sky.appendChild(e);
  });
  function apply() {
    const quiet = document.body.classList.contains("quiet-mode"),
      reduced = preference.matches;
    document.body.classList.toggle(
      "background-paused",
      quiet || reduced || document.hidden,
    );
  }
  const observer = new MutationObserver(() => {
    apply();
  });
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  document.addEventListener("visibilitychange", apply);
  preference.addEventListener("change", apply);
  apply();
})();
