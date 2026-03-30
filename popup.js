const recordBtn = document.getElementById("record");
const stopBtn = document.getElementById("stop");
const playBtn = document.getElementById("play");
const loopEnabledCheckbox = document.getElementById("loopEnabled");
const loopDelayInput = document.getElementById("loopDelay");
const loopCountInput = document.getElementById("loopCount");
const stopLoopBtn = document.getElementById("stopLoop");
const deleteBtn = document.getElementById("delete");
const exportBtn = document.getElementById("export");
const importFile = document.getElementById("importFile");
const currentRecordingEl = document.getElementById("currentRecording");
const stepsList = document.getElementById("steps");
const automationsList = document.getElementById("automations");
const logsList = document.getElementById("logs");
const logCountEl = document.getElementById("logCount");

const REPLAY_DELAY_SCALE = 0.35;
const REPLAY_MAX_STEP_DELAY_MS = 1200;
const POST_NAVIGATION_SETTLE_MS = 220;
const NAVIGATION_WAIT_TIMEOUT_MS = 4500;

let selectedAutomationId = null;
let isReplaying = false;
let replayState = {
  automationId: null,
  currentIndex: -1,
  statuses: {},
};
let loopStopRequested = false;
let editingStepKey = null;

let latestState = {
  isRecording: false,
  currentRecording: null,
  automations: [],
};

recordBtn.onclick = async () => {
  const tab = await getTargetTab();
  if (!tab?.id) {
    return;
  }

  chrome.runtime.sendMessage(
    {
      type: "START_RECORDING",
      payload: {
        startUrl: tab?.url || "",
        startTitle: tab?.title || "",
        tabId: tab?.id,
      },
    },
    () => {
      resetReplayState();
      refreshState();
    }
  );

  ensureRecorderReady(tab.id).then((recorderReady) => {
    if (!recorderReady && latestState.isRecording) {
      currentRecordingEl.innerHTML = `
        <div class="recording-row">
          <span class="recording-dot" aria-hidden="true"></span>
          <span class="recording-label">Recording live</span>
        </div>
        <div class="recording-meta"><strong>Start:</strong> ${escapeHtml(tab?.title || tab?.url || "Unknown page")}</div>
        <div class="recording-url">This page may block recorder injection. Try a standard webpage or refresh the current page.</div>
      `;
    }
  });
};

stopBtn.onclick = () => {
  chrome.runtime.sendMessage({ type: "STOP_RECORDING" }, (response) => {
    if (response?.automation?.id) {
      selectedAutomationId = response.automation.id;
    }
    refreshState();
  });
};

deleteBtn.onclick = () => {
  const automation = getSelectedAutomation();
  if (!automation) {
    return;
  }

  chrome.runtime.sendMessage({ type: "DELETE_AUTOMATION", payload: { id: automation.id } }, () => {
    if (replayState.automationId === automation.id) {
      resetReplayState();
    }
    editingStepKey = null;
    refreshState();
  });
};

playBtn.onclick = async () => {
  const automation = getSelectedAutomation();
  if (!automation || isReplaying) {
    return;
  }

  const tab = await getTargetTab();
  if (!tab?.id) {
    return;
  }

  loopStopRequested = false;

  const loopEnabled = loopEnabledCheckbox.checked;
  const loopDelayMs = Math.max(0, Number(loopDelayInput.value) || 0);
  const loopCount = loopCountInput.value.trim() ? Math.max(1, Number(loopCountInput.value)) : null;

  let iteration = 0;
  while (!loopStopRequested) {
    iteration += 1;
    await playAutomationOnce(tab.id, automation);

    if (!loopEnabled) {
      break;
    }

    if (loopCount !== null && iteration >= loopCount) {
      break;
    }

    if (loopDelayMs > 0) {
      await delay(loopDelayMs);
    }
  }

  loopStopRequested = false;
  renderState();
};

stopLoopBtn.onclick = () => {
  loopStopRequested = true;
};

exportBtn.onclick = () => {
  chrome.runtime.sendMessage({ type: "GET_AUTOMATIONS" }, (response) => {
    const automations = response?.automations || [];
    const blob = new Blob([JSON.stringify(automations, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "browser-automations.json";
    anchor.click();
    URL.revokeObjectURL(url);
  });
};

importFile.onchange = (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const automations = normalizeImportedPayload(parsed);
      chrome.runtime.sendMessage({ type: "SAVE_IMPORTED_AUTOMATIONS", payload: automations }, () => {
        refreshState();
        importFile.value = "";
      });
    } catch (error) {
      currentRecordingEl.textContent = "Import failed: invalid JSON file.";
    }
  };
  reader.readAsText(file);
};

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "RECORDING_STATE_CHANGED") {
    refreshState();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes.currentRecording || changes.automations)) {
    refreshState();
  }
});

refreshState();

function refreshState() {
  chrome.runtime.sendMessage({ type: "GET_RECORDING_STATE" }, (state) => {
    latestState = state || latestState;

    if (!selectedAutomationId && latestState.automations[0]?.id) {
      selectedAutomationId = latestState.automations[0].id;
    }

    if (
      selectedAutomationId &&
      !latestState.automations.some((automation) => automation.id === selectedAutomationId)
    ) {
      selectedAutomationId = latestState.automations[0]?.id || null;
    }

    if (
      replayState.automationId &&
      !latestState.automations.some((automation) => automation.id === replayState.automationId)
    ) {
      resetReplayState();
    }

    renderState();
  });
}

function renderState() {
  const { isRecording, currentRecording, automations } = latestState;
  const selectedAutomation = getSelectedAutomation();

  recordBtn.disabled = isRecording || isReplaying;
  stopBtn.disabled = !isRecording || isReplaying;
  playBtn.disabled = !selectedAutomation || isRecording || isReplaying;
  deleteBtn.disabled = !selectedAutomation || isRecording || isReplaying;
  stopLoopBtn.disabled = !isReplaying;
  loopEnabledCheckbox.disabled = isRecording || isReplaying;
  loopDelayInput.disabled = isRecording || isReplaying;
  loopCountInput.disabled = isRecording || isReplaying;

  recordBtn.classList.toggle("recording-live", isRecording);

  if (isRecording && currentRecording) {
    currentRecordingEl.innerHTML = `
      <div class="recording-row">
        <span class="recording-dot" aria-hidden="true"></span>
        <span class="recording-label">Recording live</span>
      </div>
      <div class="recording-meta"><strong>Name:</strong> ${escapeHtml(currentRecording.name)}</div>
      <div class="recording-meta"><strong>Start:</strong> ${escapeHtml(currentRecording.startTitle || currentRecording.startUrl || "Unknown page")}</div>
      <div class="recording-url">${escapeHtml(currentRecording.startUrl || "No URL captured")}</div>
    `;
    renderSteps(currentRecording.steps, null);
    renderLogs(currentRecording.steps);
  } else if (selectedAutomation) {
    currentRecordingEl.innerHTML = `
      <div class="recording-meta"><strong>Selected:</strong> ${escapeHtml(selectedAutomation.name)}</div>
      <div class="recording-meta"><strong>Start:</strong> ${escapeHtml(selectedAutomation.startTitle || selectedAutomation.startUrl || "Unknown page")}</div>
      <div class="recording-url">${escapeHtml(selectedAutomation.startUrl || "No start URL")}</div>
    `;
    renderSteps(
      selectedAutomation.steps,
      replayState.automationId === selectedAutomation.id ? replayState.statuses : null
    );
    renderLogs(selectedAutomation.steps);
  } else {
    currentRecordingEl.textContent = "No recording in progress.";
    stepsList.innerHTML = "";
    renderLogs([]);
  }

  renderAutomations(automations);
}

function renderSteps(steps, stepStatuses) {
  stepsList.innerHTML = "";
  const selectedAutomation = getSelectedAutomation();
  const canEdit = Boolean(selectedAutomation) && !latestState.isRecording && !isReplaying;

  if (!steps.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "Waiting for recorded actions...";
    stepsList.appendChild(emptyItem);
    return;
  }

  steps.forEach((step, index) => {
    const item = document.createElement("li");
    const status = stepStatuses?.[index] || "";
    const durationLabel = formatDuration(step.offsetMs ?? step.delay ?? 0);
    const stepKey = selectedAutomation ? `${selectedAutomation.id}:${index}` : null;
    const isEditing = canEdit && editingStepKey === stepKey;
    item.className = `step-card${status ? ` is-${status}` : ""}`;
    item.dataset.stepIndex = String(index);
    item.innerHTML = `
      <div class="step-topline">
        <span class="step-index">${index + 1}</span>
        <span class="step-type">${escapeHtml(step.type)}</span>
        <span class="step-time">${escapeHtml(durationLabel)}</span>
      </div>
      <div class="step-selector">${escapeHtml(step.selector || "Unknown element")}</div>
      <div class="step-page">${escapeHtml(step.pageTitle || step.pageUrl || "Unknown page")}</div>
      ${step.type === "input" || step.type === "navigate" ? `<div class="step-value">${escapeHtml(step.value || "")}</div>` : ""}
      ${canEdit ? `<div class="step-actions"><button class="mini-button" data-edit-step="${index}">${isEditing ? "Close" : "Edit"}</button></div>` : ""}
      ${isEditing ? renderStepEditor(step, index) : ""}
    `;
    stepsList.appendChild(item);
  });

  if (canEdit) {
    stepsList.querySelectorAll("[data-edit-step]").forEach((button) => {
      button.addEventListener("click", () => {
        const stepKey = `${selectedAutomation.id}:${button.dataset.editStep}`;
        editingStepKey = editingStepKey === stepKey ? null : stepKey;
        renderState();
      });
    });

    stepsList.querySelectorAll("[data-save-step]").forEach((button) => {
      button.addEventListener("click", () => saveEditedStep(Number(button.dataset.saveStep)));
    });

    stepsList.querySelectorAll("[data-cancel-step]").forEach((button) => {
      button.addEventListener("click", () => {
        editingStepKey = null;
        renderState();
      });
    });
  }
}

function renderLogs(steps) {
  logsList.innerHTML = "";
  logCountEl.textContent = `${steps.length} item${steps.length === 1 ? "" : "s"}`;

  if (!steps.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "No detections yet.";
    logsList.appendChild(emptyItem);
    return;
  }

  steps
    .slice()
    .reverse()
    .forEach((step, reverseIndex) => {
      const item = document.createElement("li");
      item.className = "log-card";
      item.innerHTML = `
        <div class="log-visual">
          <span class="log-tag">&lt;${escapeHtml(step.tagName || extractElementName(step.selector))}&gt;</span>
        </div>
        <div class="log-content">
          <div class="log-title">Detected ${escapeHtml(step.type)} on ${escapeHtml(step.elementLabel || extractElementName(step.selector))}</div>
          <div class="log-selector">${escapeHtml(step.selector || "Unknown selector")}</div>
          <div class="log-meta">#${steps.length - reverseIndex} • ${escapeHtml(step.pageTitle || step.pageUrl || "Unknown page")}</div>
        </div>
      `;
      logsList.appendChild(item);
    });
}

function renderAutomations(automations) {
  automationsList.innerHTML = "";

  if (!automations.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "No automations saved in browser storage.";
    automationsList.appendChild(emptyItem);
    return;
  }

  automations.forEach((automation) => {
    const item = document.createElement("li");
    item.className = automation.id === selectedAutomationId ? "selected" : "";
    item.innerHTML = `
      <button class="automation-card" data-id="${automation.id}">
        <span class="automation-name">${escapeHtml(automation.name)}</span>
        <span class="automation-meta">${automation.steps.length} step(s)</span>
        <span class="automation-meta">${escapeHtml(automation.startUrl || "No start URL")}</span>
      </button>
    `;
    automationsList.appendChild(item);
  });

  automationsList.querySelectorAll(".automation-card").forEach((button) => {
    button.addEventListener("click", () => {
      selectedAutomationId = button.dataset.id;
      if (replayState.automationId && replayState.automationId !== selectedAutomationId) {
        resetReplayState();
      }
      renderState();
    });
  });
}

function getSelectedAutomation() {
  return latestState.automations.find((automation) => automation.id === selectedAutomationId) || null;
}

function normalizeImportedPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.steps)) {
    return [payload];
  }

  throw new Error("Unsupported JSON structure");
}

function buildReplayOffsets(steps) {
  let runningOffset = 0;

  return steps.map((step) => {
    const rawDelay = Number(step.delay) || 0;
    const scaledDelay = Math.min(
      REPLAY_MAX_STEP_DELAY_MS,
      rawDelay <= 120 ? rawDelay : Math.max(120, Math.round(rawDelay * REPLAY_DELAY_SCALE))
    );
    runningOffset += scaledDelay;
    return runningOffset;
  });
}

async function executeRecordedStep(tabId, step) {
  switch (step.type) {
    case "navigate":
      return executeNavigateStep(tabId, step);
    case "click":
    case "input":
      return executeDomStep(tabId, step);
    default:
      return { ok: false, reason: "Unknown action type" };
  }
}

async function executeNavigateStep(tabId, step) {
  if (step.type === "navigate") {
    try {
      await chrome.tabs.update(tabId, { url: step.value || step.pageUrl || "" });
      await waitForTabComplete(tabId);
      await delay(POST_NAVIGATION_SETTLE_MS);
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error?.message || "Navigation replay failed" };
    }
  }
}

async function executeDomStep(tabId, step) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "EXECUTE_STEP", step });
    return response || { ok: false, reason: "No response from content script" };
  } catch (error) {
    return { ok: false, reason: error?.message || "Replay message failed" };
  }
}

async function playAutomationOnce(tabId, automation) {
  isReplaying = true;
  replayState = {
    automationId: automation.id,
    currentIndex: -1,
    statuses: {},
  };
  renderState();

  try {
    if (automation.startUrl) {
      await chrome.tabs.update(tabId, { url: automation.startUrl });
      await waitForTabComplete(tabId);
      await delay(POST_NAVIGATION_SETTLE_MS);
    }

    const recorderReady = await ensureRecorderReady(tabId);
    if (!recorderReady) {
      replayState.statuses[0] = "failure";
      return;
    }

    const replayStartTime = performance.now();
    const offsets = buildReplayOffsets(automation.steps);

    for (let index = 0; index < automation.steps.length; index += 1) {
      if (loopStopRequested) {
        break;
      }

      const step = automation.steps[index];
      const previousStep = automation.steps[index - 1] || null;
      const targetOffset = offsets[index];
      const elapsed = performance.now() - replayStartTime;
      await delay(Math.max(0, targetOffset - elapsed));

      if (previousStep && step.pageUrl && step.pageUrl !== previousStep.pageUrl) {
        await waitForExpectedStepPage(tabId, step.pageUrl);
      }

      replayState.currentIndex = index;
      replayState.statuses[index] = "running";
      renderState();
      scrollStepIntoView(index);

      const result = await executeRecordedStep(tabId, step);
      replayState.statuses[index] = result?.ok ? "success" : "failure";
      renderState();
      scrollStepIntoView(index);
    }
  } finally {
    replayState.currentIndex = -1;
    isReplaying = false;
    renderState();
  }
}

async function getTargetTab() {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    return tab;
  }

  [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab || null;
}

async function ensureRecorderReady(tabId) {
  if (await pingRecorder(tabId)) {
    return true;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch (error) {
    return false;
  }

  return pingRecorder(tabId);
}

async function pingRecorder(tabId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: "PING_RECORDER" });
      if (response?.ok) {
        return true;
      }
    } catch (error) {
      await delay(150);
    }
  }

  return false;
}

async function waitForExpectedStepPage(tabId, expectedUrl) {
  const getComparableUrl = (value) => {
    try {
      const parsed = new URL(value);
      return {
        origin: parsed.origin,
        pathname: parsed.pathname.replace(/\/+$/, "") || "/",
        hostname: parsed.hostname,
      };
    } catch (error) {
      return null;
    }
  };

  const matchesExpectedUrl = (currentUrl) => {
    if (!currentUrl || !expectedUrl) {
      return false;
    }

    const current = getComparableUrl(currentUrl);
    const expected = getComparableUrl(expectedUrl);

    if (current && expected) {
      return (
        current.origin === expected.origin &&
        (
          current.pathname === expected.pathname ||
          current.pathname.startsWith(expected.pathname + "/") ||
          expected.pathname.startsWith(current.pathname + "/")
        )
      );
    }

    return currentUrl === expectedUrl;
  };

  const start = Date.now();
  while (Date.now() - start < NAVIGATION_WAIT_TIMEOUT_MS) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (matchesExpectedUrl(tab.url) && tab.status === "complete") {
        await delay(POST_NAVIGATION_SETTLE_MS);
        return true;
      }
    } catch (error) {
      break;
    }

    await delay(150);
  }

  try {
    await chrome.tabs.update(tabId, { url: expectedUrl });
    await waitForTabComplete(tabId);
    await delay(POST_NAVIGATION_SETTLE_MS);
    return true;
  } catch (error) {
    return false;
  }
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scrollStepIntoView(index) {
  requestAnimationFrame(() => {
    const stepElement = stepsList.querySelector(`[data-step-index="${index}"]`);
    if (stepElement) {
      stepElement.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  });
}

function resetReplayState() {
  replayState = {
    automationId: null,
    currentIndex: -1,
    statuses: {},
  };
  isReplaying = false;
}

function renderStepEditor(step, index) {
  return `
    <div class="step-editor" data-step-form="${index}">
      <label class="editor-field">
        <span>Action</span>
        <select data-field="type">
          <option value="click"${step.type === "click" ? " selected" : ""}>click</option>
          <option value="input"${step.type === "input" ? " selected" : ""}>input</option>
          <option value="navigate"${step.type === "navigate" ? " selected" : ""}>navigate</option>
        </select>
      </label>
      <label class="editor-field">
        <span>Selector</span>
        <input data-field="selector" value="${escapeAttribute(step.selector || "")}">
      </label>
      <label class="editor-field">
        <span>Value</span>
        <input data-field="value" value="${escapeAttribute(step.value || "")}">
      </label>
      <label class="editor-field">
        <span>Page URL</span>
        <input data-field="pageUrl" value="${escapeAttribute(step.pageUrl || "")}">
      </label>
      <label class="editor-field small">
        <span>Timeout ms</span>
        <input data-field="timeoutMs" type="number" min="1000" value="${escapeAttribute(String(step.timeoutMs || 4000))}">
      </label>
      <div class="step-editor-actions">
        <button class="mini-button" data-save-step="${index}">Save</button>
        <button class="mini-button ghost-button" data-cancel-step="${index}">Cancel</button>
      </div>
    </div>
  `;
}

function saveEditedStep(index) {
  const selectedAutomation = getSelectedAutomation();
  if (!selectedAutomation) {
    return;
  }

  const form = stepsList.querySelector(`[data-step-form="${index}"]`);
  if (!form) {
    return;
  }

  const getValue = (field) => form.querySelector(`[data-field="${field}"]`)?.value ?? "";
  const selector = getValue("selector").trim();
  const value = getValue("value");
  const pageUrl = getValue("pageUrl").trim();
  const timeoutMs = Math.max(1000, Number(getValue("timeoutMs")) || 4000);
  const type = getValue("type");

  const updatedSteps = selectedAutomation.steps.map((step, stepIndex) => {
    if (stepIndex !== index) {
      return step;
    }

    return {
      ...step,
      type,
      selector,
      selectors: selector ? [selector, ...(step.selectors || []).filter((item) => item !== selector)] : step.selectors || [],
      locator: {
        ...(step.locator || {}),
        css: selector ? [selector, ...((step.locator?.css || []).filter((item) => item !== selector))] : step.locator?.css || [],
        text: type === "navigate" ? value || step.locator?.text || "" : step.locator?.text || step.elementLabel || "",
      },
      value,
      pageUrl: pageUrl || step.pageUrl,
      timeoutMs,
    };
  });

  chrome.runtime.sendMessage(
    {
      type: "UPDATE_AUTOMATION",
      payload: {
        ...selectedAutomation,
        steps: updatedSteps,
      },
    },
    () => {
      editingStepKey = null;
      refreshState();
    }
  );
}

function formatDuration(ms) {
  const safeMs = Math.max(0, Number(ms) || 0);
  if (safeMs < 1000) {
    return `${safeMs}ms`;
  }

  return `${(safeMs / 1000).toFixed(1)}s`;
}

function extractElementName(selector) {
  if (!selector) {
    return "element";
  }

  const normalized = selector.replace(/^#/, "").trim();
  const tagCandidate = normalized.split(/[.#\s:[>+~]/)[0];
  return tagCandidate || "element";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}
