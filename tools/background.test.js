import assert from "node:assert/strict";
import test from "node:test";

test("toggleWhitelist removes the effective parent-domain entry", async () => {
  let onMessage;
  let storedSettings = {
    statusIndicators: true,
    whitelistedDomains: { "example.com": true },
  };
  const tabs = [
    { id: 1, url: "https://shop.example.com/" },
    { id: 2, url: "https://blog.example.com/" },
  ];
  const event = { addListener() {} };

  globalThis.chrome = {
    browserAction: {
      setBadgeText() {},
      setBadgeBackgroundColor() {},
    },
    i18n: { getMessage() {} },
    notifications: { create() {} },
    runtime: {
      getManifest: () => ({ manifest_version: 2 }),
      lastError: null,
      onInstalled: event,
      onMessage: {
        addListener(listener) {
          onMessage = listener;
        },
      },
    },
    storage: {
      local: {
        get(defaults, callback) {
          callback({ settings: structuredClone(storedSettings) });
        },
        set({ settings }, callback) {
          storedSettings = structuredClone(settings);
          callback();
        },
      },
    },
    tabs: {
      create() {},
      executeScript() {},
      insertCSS() {},
      onCreated: event,
      onRemoved: event,
      onUpdated: event,
      query(_query, callback) {
        callback(structuredClone(tabs));
      },
    },
    webNavigation: {
      onCommitted: event,
      onCompleted: event,
    },
    webRequest: {
      onBeforeRequest: event,
      onHeadersReceived: event,
    },
  };

  await import("../src/data/background.js");
  await new Promise((resolve) => setImmediate(resolve));

  const sendMessage = (request) =>
    new Promise((resolve) => {
      assert.equal(onMessage(request, {}, resolve), true);
    });

  const before = await sendMessage({ command: "get_active_tab", tabId: 1 });
  assert.equal(before.tab.whitelisted, true);
  assert.equal(before.tab.hostname, "example.com");

  await sendMessage({ command: "toggle_extension", tabId: 1 });
  assert.deepEqual(storedSettings.whitelistedDomains, {});

  const activeTab = await sendMessage({ command: "get_active_tab", tabId: 1 });
  const siblingTab = await sendMessage({ command: "get_active_tab", tabId: 2 });
  assert.equal(activeTab.tab.whitelisted, false);
  assert.equal(siblingTab.tab.whitelisted, false);
});
