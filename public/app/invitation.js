// Calendar downloads and motion lifecycle; no background timers for visual effects.
const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
const syncMotion = () =>
  document.body.classList.toggle(
    "motion-paused",
    document.hidden || motionQuery.matches,
  );
document.addEventListener("visibilitychange", syncMotion);
motionQuery.addEventListener("change", syncMotion);
syncMotion();
if ("IntersectionObserver" in window)
  new IntersectionObserver((entries) => {
    for (const entry of entries)
      entry.target
        .querySelectorAll("img")
        .forEach(
          (img) =>
            (img.style.animationPlayState = entry.isIntersecting
              ? "running"
              : "paused"),
        );
  }).observe(document.querySelector(".hero"));
const button = document.getElementById("save-date");
button?.addEventListener("click", () => {
  const { date, time, groom, bride, address } = button.dataset;
  const start = new Date(`${date}T${time}:00+05:00`);
  if (!Number.isFinite(start.getTime())) return;
  const fmt = (d) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const escape = (s) =>
    String(s)
      .replaceAll("\\", "\\\\")
      .replaceAll("\r", "")
      .replaceAll("\n", "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;");
  const title = `${groom} & ${bride}`;
  // Fold by UTF-8 byte count, as required by RFC 5545 (names may be Cyrillic).
  const fold = (line) => {
    let out = "",
      part = "";
    for (const char of line) {
      if (new TextEncoder().encode(part + char).length > 73) {
        out += part + "\r\n ";
        part = "";
      }
      part += char;
    }
    return out + part;
  };
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//nvate//Wedding Atelier//RU",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@nvate`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `SUMMARY:${escape(title)}`,
    `LOCATION:${escape(address)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.map(fold).join("\r\n") + "\r\n"], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "wedding.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
