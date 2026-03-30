const STORAGE_KEYS = {
  automations: "automations",
  currentRecording: "currentRecording",
};

let isRecording = false;
let currentRecording = null;
let recordingTabId = null;

initializeRecordingState();

if (chrome.sidePanel?.setPanelBehavior) {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_RECORDING") {
    startRecording(msg.payload || {}).then(() => {
      sendResponse({ ok: true, recording: cloneRecording(currentRecording) });
    });
    return true;
  }

  if (msg.type === "STOP_RECORDING") {
    stopRecording().then((automation) => {
      sendResponse({ ok: true, automation });
    });
    return true;
  }

  if (msg.type === "GET_RECORDING_STATE") {
    getRecordingState().then((state) => sendResponse(state));
    return true;
  }

  if (msg.type === "GET_AUTOMATIONS") {
    getAutomations().then((automations) => sendResponse({ automations }));
    return true;
  }

  if (msg.type === "SAVE_IMPORTED_AUTOMATIONS") {
    saveImportedAutomations(msg.payload || []).then((automations) => {
      sendResponse({ ok: true, automations });
    });
    return true;
  }

  if (msg.type === "DELETE_AUTOMATION") {
    deleteAutomation(msg.payload?.id).then((automations) => {
      sendResponse({ ok: true, automations });
    });
    return true;
  }

  if (msg.type === "UPDATE_AUTOMATION") {
    updateAutomation(msg.payload).then((automations) => {
      sendResponse({ ok: true, automations });
    });
    return true;
  }

  if (msg.type === "STEP" && isRecording && currentRecording) {
    appendStep(msg.payload, sender).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }
});

async function initializeRecordingState() {
  const data = await storageGet([STORAGE_KEYS.currentRecording]);
  currentRecording = data.currentRecording || null;
  isRecording = Boolean(currentRecording);
}

async function startRecording(payload) {
  currentRecording = {
    id: createAutomationId(),
    name: buildAutomationName(payload.startTitle, payload.startUrl),
    startUrl: payload.startUrl || "",
    startTitle: payload.startTitle || payload.startUrl || "Untitled page",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [],
  };
  recordingTabId = Number.isInteger(payload.tabId) ? payload.tabId : null;
  isRecording = true;
  await storageSet({ [STORAGE_KEYS.currentRecording]: currentRecording });
  notifyStateChanged();
}

async function stopRecording() {
  if (!currentRecording) {
    return null;
  }

  const finishedAutomation = {
    ...currentRecording,
    updatedAt: new Date().toISOString(),
  };
  const automations = await getAutomations();
  automations.unshift(finishedAutomation);

  currentRecording = null;
  isRecording = false;
  recordingTabId = null;

  await storageSet({
    [STORAGE_KEYS.automations]: automations,
    [STORAGE_KEYS.currentRecording]: null,
  });
  notifyStateChanged();

  return finishedAutomation;
}

async function appendStep(payload, sender) {
  if (!payload || !currentRecording) {
    return;
  }

  const tab = sender.tab || {};
  const previousStep = currentRecording.steps[currentRecording.steps.length - 1];
  const step = {
    ...payload,
    pageUrl: payload.pageUrl || tab.url || currentRecording.startUrl,
    pageTitle: payload.pageTitle || tab.title || "",
    offsetMs: Number(payload.offsetMs) || (previousStep?.offsetMs || 0) + (Number(payload.delay) || 0),
    recordedAt: new Date().toISOString(),
  };

  currentRecording.steps.push(step);
  currentRecording.updatedAt = new Date().toISOString();
  await storageSet({ [STORAGE_KEYS.currentRecording]: currentRecording });
  notifyStateChanged();
}

async function getRecordingState() {
  const automations = await getAutomations();
  return {
    isRecording,
    currentRecording: cloneRecording(currentRecording),
    automations,
  };
}

async function getAutomations() {
  const data = await storageGet([STORAGE_KEYS.automations]);
  const automations = Array.isArray(data.automations) ? data.automations : [];
  return automations.map(normalizeAutomation).filter(Boolean);
}

async function saveImportedAutomations(importedAutomations) {
  const existingAutomations = await getAutomations();
  const normalizedImported = importedAutomations
    .map(normalizeAutomation)
    .filter(Boolean);
  const mergedAutomations = [...normalizedImported, ...existingAutomations]
    .reduce((acc, automation) => {
      if (!acc.some((item) => item.id === automation.id)) {
        acc.push(automation);
      }
      return acc;
    }, [])
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  await storageSet({ [STORAGE_KEYS.automations]: mergedAutomations });
  notifyStateChanged();
  return mergedAutomations;
}

async function deleteAutomation(id) {
  if (!id) {
    return getAutomations();
  }

  const automations = await getAutomations();
  const filteredAutomations = automations.filter((automation) => automation.id !== id);
  await storageSet({ [STORAGE_KEYS.automations]: filteredAutomations });
  notifyStateChanged();
  return filteredAutomations;
}

async function updateAutomation(updatedAutomation) {
  if (!updatedAutomation?.id) {
    return getAutomations();
  }

  const automations = await getAutomations();
  const normalized = normalizeAutomation({
    ...updatedAutomation,
    updatedAt: new Date().toISOString(),
  });

  const merged = automations.map((automation) =>
    automation.id === normalized.id ? normalized : automation
  );

  await storageSet({ [STORAGE_KEYS.automations]: merged });
  notifyStateChanged();
  return merged;
}

function normalizeAutomation(automation) {
  if (!automation) {
    return null;
  }

  if (Array.isArray(automation)) {
    return normalizeAutomation({ steps: automation });
  }

  let runningOffset = 0;
  const steps = Array.isArray(automation.steps)
    ? automation.steps.map((step) => {
        const normalizedOffset = Number(step.offsetMs);
        const delay = Number(step.delay) || 0;
        runningOffset = Number.isFinite(normalizedOffset) ? normalizedOffset : runningOffset + delay;

        return {
          type: step.type || "unknown",
          selector: step.selector || "",
          selectors: Array.isArray(step.selectors)
            ? step.selectors.filter(Boolean)
            : step.selector
              ? [step.selector]
              : [],
          locator: normalizeLocator(step),
          elementLabel: step.elementLabel || "",
          tagName: step.tagName || "",
          value: step.value ?? "",
          delay,
          offsetMs: runningOffset,
          timeoutMs: Math.max(1000, Number(step.timeoutMs) || 4000),
          pageUrl: step.pageUrl || automation.startUrl || "",
          pageTitle: step.pageTitle || automation.startTitle || "",
          recordedAt: step.recordedAt || automation.updatedAt || new Date().toISOString(),
        };
      })
    : [];

  const startUrl = automation.startUrl || steps[0]?.pageUrl || "";
  const startTitle = automation.startTitle || steps[0]?.pageTitle || startUrl || "Imported automation";
  const updatedAt = automation.updatedAt || automation.startedAt || new Date().toISOString();

  return {
    id: automation.id || createAutomationId(),
    name: automation.name || buildAutomationName(startTitle, startUrl),
    startUrl,
    startTitle,
    startedAt: automation.startedAt || updatedAt,
    updatedAt,
    steps,
  };
}

function buildAutomationName(title, url) {
  if (title) {
    return title.slice(0, 60);
  }

  if (url) {
    try {
      return new URL(url).hostname;
    } catch (error) {
      return url.slice(0, 60);
    }
  }

  return "Untitled automation";
}

function normalizeLocator(step) {
  const locator = step?.locator || {};
  return {
    id: locator.id || extractIdSelector(step?.selector || ""),
    css: Array.isArray(locator.css)
      ? locator.css.filter(Boolean)
      : Array.isArray(step?.selectors)
        ? step.selectors.filter(Boolean)
        : step?.selector
          ? [step.selector]
          : [],
    data: Array.isArray(locator.data) ? locator.data.filter(Boolean) : [],
    ariaLabel: locator.ariaLabel || "",
    text: locator.text || step?.elementLabel || "",
    xpath: locator.xpath || "",
  };
}

function extractIdSelector(selector) {
  if (!selector || !selector.startsWith("#")) {
    return "";
  }

  return selector.slice(1);
}

function createAutomationId() {
  return `automation_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cloneRecording(recording) {
  return recording ? JSON.parse(JSON.stringify(recording)) : null;
}

function notifyStateChanged() {
  chrome.runtime.sendMessage({ type: "RECORDING_STATE_CHANGED" }, () => {
    if (chrome.runtime.lastError) {
      return;
    }
  });
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(items) {
  return new Promise((resolve) => chrome.storage.local.set(items, resolve));
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!isRecording || !currentRecording || recordingTabId === null || tabId !== recordingTabId) {
    return;
  }

  if (changeInfo.status !== "complete" || !tab.url) {
    return;
  }

  const lastStep = currentRecording.steps[currentRecording.steps.length - 1];
  const sameUrlAsLastStep = lastStep?.pageUrl === tab.url;
  const sameUrlAsStart = currentRecording.steps.length === 0 && currentRecording.startUrl === tab.url;
  const navigationAlreadyImpliedByClick =
    lastStep?.type === "click" &&
    lastStep.pageUrl &&
    lastStep.pageUrl !== tab.url;

  if (sameUrlAsLastStep || sameUrlAsStart || navigationAlreadyImpliedByClick) {
    return;
  }

  appendNavigationStep(tab);
});

async function appendNavigationStep(tab) {
  if (!currentRecording) {
    return;
  }

  const previousStep = currentRecording.steps[currentRecording.steps.length - 1];
  const step = {
    type: "navigate",
    selector: "browser://address-bar",
    selectors: ["browser://address-bar"],
    elementLabel: tab.title || tab.url || "Navigation",
    tagName: "navigation",
    value: tab.url || "",
    delay: 0,
    pageUrl: tab.url || currentRecording.startUrl,
    pageTitle: tab.title || currentRecording.startTitle || "",
    offsetMs: previousStep?.offsetMs || 0,
    recordedAt: new Date().toISOString(),
  };

  currentRecording.steps.push(step);
  currentRecording.updatedAt = new Date().toISOString();
  await storageSet({ [STORAGE_KEYS.currentRecording]: currentRecording });
  notifyStateChanged();
}
