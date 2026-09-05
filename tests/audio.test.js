import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { audioWidget } from "../src/blocks.js";

function renderedPlayer({ start = 0, end = 0 } = {}) {
  const listeners = new Map();
  const classes = new Set();
  const audio = {
    currentTime: 0,
    volume: 1,
    paused: true,
    loop: false,
    playCalls: 0,
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    play() {
      this.playCalls++;
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
  };
  const button = {
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
    },
    addEventListener(type, callback) {
      listeners.set(`button:${type}`, callback);
    },
  };
  const context = {
    window: {},
    document: {
      getElementById: (id) => ({ bgm: audio, mbtn: button })[id],
    },
    // Fade timers are unrelated to looping; keep them out of the event loop.
    setInterval: () => 1,
    clearInterval() {},
  };
  const html = audioWidget({
    playable: true,
    url: "/music/test.mp3",
    start,
    end,
  });
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "audioWidget should render an executable player script");
  vm.runInNewContext(script, context);

  return {
    audio,
    classes,
    start: () => context.window.__music.start(),
    emit: (type) => listeners.get(type)?.(),
    click: () => listeners.get("button:click")({ stopPropagation() {} }),
  };
}

test("a start-only trim repeats from its selected start after every ending", async () => {
  const player = renderedPlayer({ start: 15 });
  assert.equal(player.audio.playCalls, 0, "rendering must not start playback");
  assert.equal(player.audio.loop, false, "native looping would restart at zero");

  player.start();
  await Promise.resolve();
  assert.equal(player.audio.currentTime, 15);
  assert.equal(player.audio.playCalls, 1);

  for (const expectedCalls of [2, 3]) {
    player.audio.currentTime = 90;
    player.audio.paused = true;
    player.emit("ended");
    await Promise.resolve();
    assert.equal(player.audio.currentTime, 15);
    assert.equal(player.audio.playCalls, expectedCalls);
    assert.equal(player.audio.paused, false);
  }
});

test("an explicit end still repeats only when the trim boundary is reached", async () => {
  const player = renderedPlayer({ start: 5, end: 12 });
  player.start();
  await Promise.resolve();
  assert.equal(player.audio.loop, false);

  player.audio.currentTime = 11.9;
  player.emit("timeupdate");
  assert.equal(player.audio.playCalls, 1);
  assert.equal(player.audio.currentTime, 11.9);

  player.audio.currentTime = 12;
  player.emit("timeupdate");
  assert.equal(player.audio.currentTime, 5);
  assert.equal(player.audio.playCalls, 2);
});

test("untrimmed tracks retain native looping and click-to-play/pause", async () => {
  const player = renderedPlayer();
  assert.equal(player.audio.loop, true);
  assert.equal(player.audio.playCalls, 0);

  player.click();
  await Promise.resolve();
  assert.equal(player.audio.playCalls, 1);
  assert.equal(player.audio.paused, false);
  assert.equal(player.classes.has("on"), true);

  player.click();
  assert.equal(player.audio.paused, true);
  assert.equal(player.classes.has("on"), false);
});
