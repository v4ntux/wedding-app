export function bootEditor({
  $,
  text,
  storage,
  state,
  t,
  money,
  api,
  toast,
  showView,
  openDemo,
}) {
  const form = $("invitation-form");
  const field = (name) => form.elements.namedItem(name);
  const draftKey = "nvate_atelier_draft_v1";
  const photoPattern = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
  let step = 0,
    photos = [],
    music = null,
    saving = null,
    liveTimer = null,
    sending = false,
    uploading = false;
  const selected = () =>
    state.config?.templates.find((x) => x.id === state.templateId);
  const guestNames = () =>
    field("personalGuests").checked
      ? [
          ...new Set(
            field("guestNames")
              .value.split("\n")
              .map((x) => x.trim())
              .filter(Boolean),
          ),
        ]
      : [];
  const rawFields = () =>
    Object.fromEntries(
      [...form.elements]
        .filter((el) => el.name)
        .map((el) => [el.name, el.type === "checkbox" ? el.checked : el.value]),
    );
  // Migrate the previous studio's device-local draft without discarding uploads.
  function migrateDraft() {
    if (storage.get(draftKey)) return;
    try {
      const old = JSON.parse(storage.get("nv_draft_v4") || "null");
      if (!old || ![4, 5].includes(old.v)) return;
      const migrated = storage.set(
        draftKey,
        JSON.stringify({
          v: 1,
          step: 0,
          templateId: old.templateId,
          photos: old.photos,
          music: old.music,
          fields: {
            groomName: old.groom || "",
            brideName: old.bride || "",
            weddingDate: old.dateIso || "",
            weddingTime: old.time || "18:00",
            address: old.address || "",
            mapEnabled: Boolean(old.mapOn),
            lat: old.lat == null ? "" : String(old.lat),
            lng: old.lng == null ? "" : String(old.lng),
            personalGuests: Boolean(old.guestsOn),
            guestNames: (old.guests || []).join("\n"),
            contactTg: old.contactTg || "",
            phone: old.phone || "",
            phone2: old.phone2 || "",
            musicLink:
              old.music?.type === "youtube" || old.music?.type === "custom"
                ? old.music.value
                : "",
            musicStart: "0",
            musicEnd: "",
          },
        }),
      );
      if (migrated) storage.remove("nv_draft_v4");
    } catch {
      /* A malformed legacy draft must not prevent entry. */
    }
  }
  migrateDraft();
  function payload() {
    const v = rawFields();
    return {
      lang: state.lang,
      groomName: v.groomName.trim(),
      brideName: v.brideName.trim(),
      weddingDate: v.weddingDate,
      weddingTime: v.weddingTime,
      mapEnabled: v.mapEnabled,
      lat: v.mapEnabled ? Number(v.lat) : null,
      lng: v.mapEnabled ? Number(v.lng) : null,
      address: v.address.trim(),
      photos: [...photos],
      musicType: music?.type || "none",
      musicValue: music?.value || null,
      musicStart: Number(v.musicStart) || 0,
      musicEnd: v.musicEnd ? Number(v.musicEnd) : null,
      templateId: state.templateId,
      guestNames: guestNames(),
      contactTg: v.contactTg.trim(),
      phone: v.phone.trim(),
      phone2: v.phone2.trim(),
    };
  }
  function save() {
    clearTimeout(saving);
    saving = setTimeout(() => {
      const ok = storage.set(
        draftKey,
        JSON.stringify({
          v: 1,
          fields: rawFields(),
          photos,
          music,
          templateId: state.templateId,
          step,
        }),
      );
      $("draft-status").textContent = t(ok ? "saved" : "notSaved");
    }, 350);
  }
  function restore() {
    try {
      const draft = JSON.parse(storage.get(draftKey) || "null");
      if (draft?.v !== 1) return;
      for (const [key, value] of Object.entries(draft.fields || {})) {
        const el = field(key);
        if (!el || el.type === "file") continue;
        if (el.type === "checkbox") el.checked = value === true;
        else el.value = typeof value === "string" ? value : "";
      }
      photos = Array.isArray(draft.photos)
        ? draft.photos
            .filter((x) => typeof x === "string" && photoPattern.test(x))
            .slice(0, state.config.maxPhotos)
        : [];
      music =
        draft.music &&
        ["upload", "youtube", "custom", "itunes"].includes(draft.music.type)
          ? draft.music
          : null;
      state.templateId = state.config.templates.some(
        (x) => x.id === draft.templateId,
      )
        ? draft.templateId
        : null;
      step = Math.min(3, Math.max(0, Number(draft.step) || 0));
      refresh();
    } catch {
      storage.remove(draftKey);
    }
  }
  function choose(id) {
    if (!state.config.templates.some((x) => x.id === id)) return;
    state.templateId = id;
    showView("editor");
    refresh();
    showStep(step, false);
    const heading = document.querySelector(`[data-panel="${step}"] h2`);
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    updateLive();
    save();
  }
  function showStep(n, scroll = true) {
    step = Math.max(0, Math.min(3, n));
    document
      .querySelectorAll("[data-panel]")
      .forEach((el) => (el.hidden = Number(el.dataset.panel) !== step));
    document.querySelectorAll("[data-step]").forEach((el) => {
      const active = Number(el.dataset.step) === step;
      el.classList.toggle("active", active);
      if (active) el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    });
    $("prev-step").hidden = step === 0;
    $("next-step").firstElementChild.textContent = t(
      sending ? "sending" : step === 3 ? "submit" : "continue",
    );
    $("next-step").disabled = sending || uploading;
    $("form-error").hidden = true;
    if (scroll) {
      form.scrollIntoView({
        block: "start",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
      const heading = document.querySelector(`[data-panel="${step}"] h2`);
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    save();
  }
  function renderPhotos() {
    const root = $("photo-list");
    root.replaceChildren();
    photos.forEach((name, index) => {
      const item = text("figure", "", "photo-item");
      const img = document.createElement("img");
      img.src = `/uploads/${name}`;
      img.alt = `${t("photos")} ${index + 1}`;
      const remove = text("button", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", `${t("photoRemove")} ${index + 1}`);
      remove.onclick = () => {
        photos = photos.filter((p) => p !== name);
        renderPhotos();
        save();
      };
      item.append(img, remove);
      root.append(item);
    });
    $("photo-count").textContent =
      `${photos.length} / ${state.config?.maxPhotos || 6}`;
    $("photo-requirement").textContent = t("photoNeed", {
      n: selected()?.minPhotos || 0,
      max: state.config?.maxPhotos || 6,
    });
  }
  function refresh() {
    if (!state.config) return;
    $("editor-title").textContent = selected()?.name || "";
    renderPhotos();
    $("coordinate-fields").hidden = !field("mapEnabled").checked;
    $("guests-fields").hidden = !field("personalGuests").checked;
    $("music-selected").textContent = music?.name || t("noMusic");
    const names = guestNames(),
      cost = names.length * state.config.guestPrice;
    $("guest-total").textContent = t("guestCount", {
      n: names.length,
      price: money(cost),
    });
    $("bill-template").textContent = selected()?.name || "";
    $("bill-template-price").textContent = money(selected()?.price);
    $("bill-guests-row").hidden = !names.length;
    $("bill-guests-price").textContent = money(cost);
    $("bill-total").textContent = money((selected()?.price || 0) + cost);
    if (state.view === "editor") {
      $("next-step").firstElementChild.textContent = t(
        step === 3 ? "submit" : "continue",
      );
      updateLive();
    }
    const lat = Number(field("lat").value),
      lng = Number(field("lng").value);
    const valid =
      field("mapEnabled").checked &&
      field("lat").value !== "" &&
      field("lng").value !== "" &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180;
    $("map-check").hidden = !valid;
    if (valid)
      $("map-check").href = `https://www.google.com/maps?q=${lat},${lng}`;
  }
  function demoQuery() {
    const v = payload();
    return new URLSearchParams({
      lang: state.lang,
      groom: v.groomName || (state.lang === 'ru' ? 'Александр' : 'Javohir'),
      bride: v.brideName || (state.lang === 'ru' ? 'София' : 'Madina'),
      date: v.weddingDate,
      time: v.weddingTime,
      address: v.address,
      map: v.mapEnabled ? "1" : "0",
      lat: v.lat ?? "",
      lng: v.lng ?? "",
    });
  }
  function updateLive() {
    clearTimeout(liveTimer);
    if (state.view !== "editor" || !selected()) return;
    liveTimer = setTimeout(() => {
      const q = demoQuery();
      q.set("card", "1");
      if (state.view !== "editor" || !selected()) return;
      const url = `${selected().demoUrl}?${q}`;
      const iframe = $("live-frame");
      if (iframe.getAttribute("src") !== url) iframe.src = url;
    }, 550);
  }
  function error(message, n = step, input) {
    showStep(n, false);
    $("form-error").textContent = message;
    $("form-error").hidden = false;
    if (input) {
      input.setAttribute("aria-invalid", "true");
      input.focus();
    } else
      $("form-error").scrollIntoView({ block: "nearest", behavior: "smooth" });
    return false;
  }
  function validate(n) {
    const required =
      n === 0
        ? ["groomName", "brideName", "weddingDate", "weddingTime", "address"]
        : n === 1
          ? ["musicLink", "musicStart", "musicEnd"]
          : [];
    if (n === 0 && field("mapEnabled").checked) required.push("lat", "lng");
    for (const name of required) {
      const el = field(name);
      const needed = n === 0;
      if ((needed && !el.value.trim()) || !el.checkValidity())
        return error(t("required"), n, el);
    }
    if (n === 1) {
      const minimum = selected()?.minPhotos || 0;
      if (photos.length < minimum)
        return error(t("photoError", { n: minimum }), n);
      if (field("musicLink").value && !musicFromLink())
        return error(t("musicError"), n, field("musicLink"));
      if (
        field("musicEnd").value &&
        Number(field("musicEnd").value) <= Number(field("musicStart").value)
      )
        return error(t("required"), n, field("musicEnd"));
    }
    if (n === 2) {
      const names = guestNames();
      if (
        names.length > state.config.maxGuests ||
        names.some((x) => x.length > 50)
      )
        return error(
          t("guestError", { n: state.config.maxGuests }),
          n,
          field("guestNames"),
        );
    }
    if (n === 3) {
      const user = /^@?[a-zA-Z0-9_]{4,32}$/,
        phone = /^\+?[\d\s()-]{7,20}$/;
      const entries = [
        ["contactTg", user],
        ["phone", phone],
        ["phone2", null],
      ];
      let count = 0;
      for (const [name, re] of entries) {
        const value = field(name).value.trim();
        if (!value) continue;
        if (re ? !re.test(value) : !user.test(value) && !phone.test(value))
          return error(t("contactError"), n, field(name));
        count++;
      }
      if (count < 2) return error(t("contactError"), n, field("contactTg"));
    }
    return true;
  }
  function musicFromLink() {
    const value = field("musicLink").value.trim();
    if (!value) return true;
    let url;
    try {
      url = new URL(value);
    } catch {
      return false;
    }
    if (!["https:", "http:"].includes(url.protocol)) return false;
    const youtube = [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "youtu.be",
    ].includes(url.hostname);
    const id = youtube
      ? url.hostname === "youtu.be"
        ? url.pathname.slice(1)
        : url.searchParams.get("v") || url.pathname.split("/").pop()
      : null;
    if (youtube && /^[\w-]{11}$/.test(id || "")) {
      music = {
        type: "youtube",
        value: `https://www.youtube.com/watch?v=${id}`,
        name: "YouTube",
      };
      return true;
    }
    if (/\.(mp3|m4a|ogg|wav)$/i.test(url.pathname)) {
      music = {
        type: "custom",
        value: url.href,
        name: url.pathname.split("/").pop(),
      };
      return true;
    }
    return false;
  }
  form.addEventListener("input", (event) => {
    event.target.removeAttribute("aria-invalid");
    $("form-error").hidden = true;
    if (event.target.name === "musicLink") {
      music = null;
      musicFromLink();
    }
    refresh();
    save();
  });
  form.addEventListener("change", () => {
    refresh();
    save();
  });
  document
    .querySelectorAll("[data-step]")
    .forEach(
      (button) =>
        (button.onclick = () => showStep(Number(button.dataset.step))),
    );
  $("prev-step").onclick = () => showStep(step - 1);
  async function upload(file, kind) {
    if (!file || file.size > 16 * 1024 * 1024 || file.size === 0)
      throw new Error(t("fileError"));
    if (
      kind === "image" &&
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      throw new Error(t("fileError"));
    const result = await api("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: file,
    });
    if (result.kind !== kind) throw new Error(t("fileError"));
    return result.file;
  }
  $("photo-input").addEventListener("change", async (event) => {
    if (uploading) return;
    const files = [...event.target.files];
    uploading = true;
    $("next-step").disabled = true;
    event.target.disabled = true;
    try {
      if (files.length + photos.length > state.config.maxPhotos)
        throw new Error(t("tooMany", { n: state.config.maxPhotos }));
      toast(t("uploading"));
      for (const file of files) {
        photos.push(await upload(file, "image"));
        renderPhotos();
        save();
      }
      toast(t("saved"));
    } catch (e) {
      error(e.message, 1);
    } finally {
      uploading = false;
      event.target.disabled = false;
      event.target.value = "";
      $("next-step").disabled = false;
    }
  });
  $("music-input").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file || uploading) return;
    uploading = true;
    event.target.disabled = true;
    $("next-step").disabled = true;
    try {
      toast(t("uploading"));
      const name = await upload(file, "audio");
      music = { type: "upload", value: name, name: file.name };
      field("musicLink").value = "";
      refresh();
      save();
    } catch (e) {
      error(e.message, 1);
    } finally {
      uploading = false;
      event.target.disabled = false;
      event.target.value = "";
      $("next-step").disabled = false;
    }
  });
  $("clear-music").onclick = () => {
    music = null;
    field("musicLink").value = "";
    field("musicStart").value = "0";
    field("musicEnd").value = "";
    refresh();
    save();
  };
  const catalogPlayer = new Audio();
  let playingButton = null;
  const stopCatalog = () => {
    catalogPlayer.pause();
    if (playingButton) {
      playingButton.textContent = "▷";
      playingButton.setAttribute("aria-label", t("listen"));
    }
    playingButton = null;
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopCatalog();
  });
  new MutationObserver(() => {
    if ($("editor-view").hidden) stopCatalog();
  }).observe($("editor-view"), {
    attributes: true,
    attributeFilter: ["hidden"],
  });
  catalogPlayer.addEventListener("ended", stopCatalog);
  $("venue-search-button").onclick = async () => {
    const q = $("venue-search").value.trim();
    if (q.length < 2) return;
    const btn = $("venue-search-button"),
      root = $("venue-results");
    btn.disabled = true;
    root.replaceChildren(text("p", t("loading"), "field-help"));
    try {
      const data = await api(
        `/api/geo?q=${encodeURIComponent(q)}&lang=${state.lang}`,
      );
      root.replaceChildren();
      if (!data.results.length)
        root.append(text("p", t("noResults"), "field-help"));
      for (const place of data.results) {
        const choose = text("button", "", "search-result");
        choose.type = "button";
        choose.append(text("b", place.name), text("span", place.desc || ""));
        choose.onclick = () => {
          field("lat").value = String(place.lat);
          field("lng").value = String(place.lng);
          field("address").value = place.name;
          root.replaceChildren();
          refresh();
          save();
        };
        root.append(choose);
      }
    } catch (e) {
      root.replaceChildren(text("p", e.message, "field-help"));
    } finally {
      btn.disabled = false;
    }
  };
  $("music-search-button").onclick = async () => {
    const q = $("music-search").value.trim();
    const btn = $("music-search-button"),
      root = $("music-results");
    btn.disabled = true;
    stopCatalog();
    root.replaceChildren(text("p", t("loading"), "field-help"));
    try {
      const data = await api(`/api/music?q=${encodeURIComponent(q)}`);
      root.replaceChildren();
      if (!data.tracks.length)
        root.append(text("p", t("noResults"), "field-help"));
      for (const track of data.tracks) {
        const row = text("div", "", "track-result"),
          info = text("span", "", "track-info"),
          play = text("button", "▷", "track-play"),
          choose = text("button", t("selectTrack"), "text-button");
        play.type = choose.type = "button";
        play.setAttribute("aria-label", `${t("listen")}: ${track.name}`);
        info.append(text("b", track.name), text("span", track.artist));
        play.onclick = async () => {
          if (playingButton === play) {
            stopCatalog();
            return;
          }
          stopCatalog();
          playingButton = play;
          catalogPlayer.src = track.url;
          try {
            await catalogPlayer.play();
            play.textContent = "Ⅱ";
            play.setAttribute("aria-label", t("pause"));
          } catch {
            stopCatalog();
            toast(t("net"));
          }
        };
        choose.onclick = () => {
          stopCatalog();
          music = {
            type: "itunes",
            value: { name: track.name, artist: track.artist, url: track.url },
            name: `${track.name} — ${track.artist}`,
          };
          field("musicLink").value = "";
          refresh();
          save();
          root.replaceChildren();
        };
        row.append(play, info, choose);
        root.append(row);
      }
    } catch (e) {
      root.replaceChildren(text("p", e.message, "field-help"));
    } finally {
      btn.disabled = false;
    }
  };
  for (const [input, button] of [
    ["venue-search", "venue-search-button"],
    ["music-search", "music-search-button"],
  ])
    $(input).addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        $(button).click();
      }
    });
  $("expand-preview").onclick = () => {
    if (selected()) openDemo(selected(), demoQuery());
  };
  $("full-preview").onclick = async () => {
    for (let n = 0; n < 3; n++) if (!validate(n)) return;
    const button = $("full-preview");
    button.disabled = true;
    try {
      const result = await api("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: window.Telegram?.WebApp?.initData || "",
          form: payload(),
        }),
      });
      $("preview-title").textContent = selected().name;
      $("preview-frame").removeAttribute("src");
      $("preview-frame").srcdoc = result.html;
      $("choose-preview").hidden = true;
      $("preview-dialog").showModal();
    } catch (e) {
      error(
        e.message,
        {
          names: 0,
          datetime: 0,
          location: 0,
          photos: 1,
          music: 1,
          guests: 2,
          review: 3,
        }[e.step] ?? step,
      );
    } finally {
      button.disabled = false;
    }
  };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending || uploading) return;
    if (step < 3) {
      if (validate(step)) showStep(step + 1);
      return;
    }
    for (let n = 0; n < 4; n++) if (!validate(n)) return;
    sending = true;
    const request = payload();
    form.inert = true;
    $("next-step").disabled = true;
    $("next-step").firstElementChild.textContent = t("sending");
    try {
      const result = await api("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: window.Telegram?.WebApp?.initData || "",
          form: request,
        }),
      });
      clearTimeout(saving);
      storage.remove(draftKey);
      storage.remove("nv_draft_v4");
      $("success-copy").textContent = t("successCopy", { id: result.id });
      $("success-dialog").showModal();
      form.reset();
      photos = [];
      music = null;
      step = 0;
      state.templateId = null;
      $("live-frame").src = "about:blank";
      $("draft-status").textContent = "";
    } catch (e) {
      error(
        e.message,
        {
          names: 0,
          datetime: 0,
          location: 0,
          template: 0,
          photos: 1,
          music: 1,
          guests: 2,
          review: 3,
        }[e.step] ?? 3,
      );
    } finally {
      sending = false;
      form.inert = false;
      $("next-step").disabled = false;
      $("next-step").firstElementChild.textContent = t(
        step === 3 ? "submit" : "continue",
      );
    }
  });
  $("close-success").onclick = () => {
    $("success-dialog").close();
    showView("collection");
  };
  $("success-dialog").addEventListener("cancel", () => showView("collection"));
  return { choose, refresh, restore };
}
