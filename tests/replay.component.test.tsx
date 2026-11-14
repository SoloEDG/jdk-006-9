// @ts-nocheck
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Audio = class Audio {
  constructor() {
    this.paused = true;
    this.currentTime = 0;
    this.duration = 10;
    this.volume = 1;
    this.playbackRate = 1;
    this.listeners = {};
  }
  addEventListener(name, fn) {
    (this.listeners[name] ??= []).push(fn);
  }
  removeEventListener() {}
  removeAttribute() {}
  load() {}
  pause() {
    this.paused = true;
  }
  async play() {
    this.paused = false;
  }
};
globalThis.localStorage = (() => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
})();
Object.defineProperty(globalThis, "crypto", {
  value: dom.window.crypto,
  configurable: true,
  writable: true,
});
globalThis.structuredClone = (v) => JSON.parse(JSON.stringify(v));

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { ReplayCenterDialog, ReplayStage, useReplayArchive } = await import(
  "../src/features/replay/index.ts"
);
const { CASE_CONTENT } = await import("../src/features/story/index.ts");
const { createSavedProgram } = await import(
  "../src/features/replay/model/fingerprint.ts"
);

function makeSlot(id, name, decisions, clues, heard) {
  return {
    id,
    name,
    updatedAt: 1700000000000,
    snapshot: {
      version: 1,
      caseId: CASE_CONTENT.id,
      story: {
        sceneId: decisions.length ? "interview" : "arrival",
        visited: ["arrival", "harbor", "interview"],
        decisions,
        ending: null,
      },
      evidence: { notes: [], clues, selectedId: null },
      heard,
      resume: { sceneId: "interview", position: 0, rate: 1 },
    },
  };
}

const slotA = makeSlot(
  "a",
  "码头路线",
  [
    { sceneId: "arrival", choiceId: "visit-harbor" },
    { sceneId: "harbor", choiceId: "ask-keeper" },
  ],
  [],
  { "arrival-normal": 5, "harbor-normal": 5, "interview-normal": 5 },
);
const slotB = makeSlot(
  "b",
  "守塔路线",
  [{ sceneId: "arrival", choiceId: "visit-keeper" }],
  [],
  { "arrival-normal": 5, "interview-normal": 5 },
);

async function render(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
    },
  };
}

test("ReplayCenterDialog 渲染两份存档并可生成节目单", async () => {
  let created = null;
  const { container, unmount } = await render(
    React.createElement(ReplayCenterDialog, {
      content: CASE_CONTENT,
      slots: [slotA, slotB],
      programs: [],
      notice: null,
      onCreate: (a, b, name) => {
        created = { a, b, name };
      },
      onDelete: () => {},
      onExport: () => {},
      onImport: () => {},
      onOpen: () => {},
      onClose: () => {},
    }),
  );
  assert.ok(container.textContent.includes("路线收听档案"));
  const selects = container.querySelectorAll("select");
  assert.equal(selects.length, 2);
  assert.ok(selects[0].textContent.includes("码头路线"));
  const submit = container.querySelector("form button.primary-button");
  // 未选择时禁用
  assert.equal(submit.disabled, true);
  await act(async () => {
    selects[0].value = "a";
    selects[0].dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    selects[1].value = "b";
    selects[1].dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  assert.equal(submit.disabled, false);
  await act(async () => {
    container
      .querySelector("form")
      .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  });
  assert.deepEqual(created, { a: "a", b: "b", name: "路线对照节目单" });
  await unmount();
});

test("ReplayStage 渲染节目单、分歧标记与可信度，切换路线不崩溃", async () => {
  const saved = createSavedProgram(
    CASE_CONTENT,
    [slotA, slotB],
    "对照",
    "doc-x",
    Date.now(),
  );
  const { container, unmount } = await render(
    React.createElement(ReplayStage, {
      program: saved,
      onExit: () => {},
    }),
  );
  assert.ok(container.textContent.includes("退出对照"));
  // 路线 A 有 3 个片段
  assert.equal(container.querySelectorAll(".replay-chip").length, 3);
  // 导航到第一次分歧片段（index 1）后出现分歧横幅
  await act(async () => {
    container
      .querySelectorAll(".replay-chip")[1]
      .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  assert.ok(container.querySelector(".replay-divergence-banner"));
  // 可信度标签存在
  assert.ok(container.textContent.includes("已证实") || container.textContent.includes("版本推断"));

  // 切到路线 B
  const tabs = container.querySelectorAll(".replay-route-tab");
  await act(async () => {
    tabs[1].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  assert.equal(container.querySelectorAll(".replay-chip").length, 2);
  // 双字幕块仍在
  assert.equal(container.querySelectorAll(".replay-subtitle-block").length, 2);

  // 点击片段轨道导航
  await act(async () => {
    container
      .querySelectorAll(".replay-chip")[0]
      .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  assert.ok(container.querySelector(".replay-stage"));
  await unmount();
});

test("useReplayArchive 生成、持久化并可重新读取自包含节目单", async () => {
  function Harness() {
    const archive = useReplayArchive(CASE_CONTENT, [slotA, slotB]);
    return React.createElement(
      "div",
      null,
      React.createElement(
        "button",
        {
          onClick: () => archive.createFromSlots("a", "b", "持久化测试"),
        },
        "create",
      ),
      React.createElement("span", { id: "count" }, String(archive.programs.length)),
    );
  }
  const { container, unmount } = await render(React.createElement(Harness));
  await act(async () => {
    container.querySelector("button").click();
  });
  assert.equal(container.querySelector("#count").textContent, "1");
  const raw = localStorage.getItem("midnight-frequency:replay-programs:v1");
  const parsed = JSON.parse(raw);
  assert.equal(parsed[0].sources.length, 2);
  assert.ok(parsed[0].programs[0].entries[0].cues.length > 0);
  await unmount();
});
