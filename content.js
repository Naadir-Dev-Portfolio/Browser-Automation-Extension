if (!window.__baeRecorderInitialized) {
  window.__baeRecorderInitialized = true;

  let lastTime = Date.now();

  function getActionableElement(element) {
    if (!element || typeof element.closest !== "function") {
      return element;
    }

    return (
      element.closest("button, a, input, textarea, select, [role='button'], [type='submit'], [type='button']") ||
      element
    );
  }

  function escapeSelectorValue(value) {
    if (window.CSS?.escape) {
      return window.CSS.escape(value);
    }

    return String(value).replace(/["\\]/g, "\\$&");
  }

  function createDomPath(element) {
    const parts = [];
    let current = element;

    while (current && current.nodeType === 1 && parts.length < 6) {
      let part = current.tagName.toLowerCase();

      if (current.id) {
        part += `#${escapeSelectorValue(current.id)}`;
        parts.unshift(part);
        break;
      }

      const siblings = current.parentElement
        ? Array.from(current.parentElement.children).filter((node) => node.tagName === current.tagName)
        : [];

      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }

      parts.unshift(part);
      current = current.parentElement;
    }

    return parts.join(" > ");
  }

  function getDataAttributes(element) {
    if (!element?.attributes) {
      return [];
    }

    return Array.from(element.attributes)
      .filter((attribute) => attribute.name.startsWith("data-") && attribute.value)
      .slice(0, 3)
      .map((attribute) => ({ name: attribute.name, value: attribute.value }));
  }

  function getTextLocator(element) {
    const value = (
      element?.getAttribute?.("aria-label") ||
      element?.innerText ||
      element?.textContent ||
      element?.value ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();

    return value.slice(0, 80);
  }

  function createXPath(element) {
    if (!element || element.nodeType !== 1) {
      return "";
    }

    if (element.id) {
      return `//*[@id="${element.id.replace(/"/g, '\\"')}"]`;
    }

    const parts = [];
    let current = element;
    while (current && current.nodeType === 1) {
      const siblings = current.parentNode
        ? Array.from(current.parentNode.children).filter((node) => node.tagName === current.tagName)
        : [];
      const index = siblings.length > 1 ? `[${siblings.indexOf(current) + 1}]` : "";
      parts.unshift(`${current.tagName.toLowerCase()}${index}`);
      current = current.parentElement;
    }

    return `/${parts.join("/")}`;
  }

  function getSelectorCandidates(element) {
    if (!element) {
      return [""];
    }

    const tag = element.tagName.toLowerCase();
    const candidates = [];

    if (element.id) {
      candidates.push(`#${escapeSelectorValue(element.id)}`);
    }

    const name = element.getAttribute("name");
    if (name) {
      candidates.push(`${tag}[name="${escapeSelectorValue(name)}"]`);
    }

    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) {
      candidates.push(`${tag}[aria-label="${escapeSelectorValue(ariaLabel)}"]`);
    }

    const type = element.getAttribute("type");
    if (type) {
      candidates.push(`${tag}[type="${escapeSelectorValue(type)}"]`);
    }

    getDataAttributes(element).forEach((attribute) => {
      candidates.push(`${tag}[${attribute.name}="${escapeSelectorValue(attribute.value)}"]`);
    });

    if (typeof element.className === "string" && element.className.trim()) {
      candidates.push(`${tag}.${element.className.trim().split(/\s+/).slice(0, 3).join(".")}`);
    }

    candidates.push(createDomPath(element));
    return [...new Set(candidates.filter(Boolean))];
  }

  function buildLocator(element, selectors) {
    return {
      id: element?.id || "",
      css: selectors,
      data: getDataAttributes(element),
      ariaLabel: element?.getAttribute?.("aria-label") || "",
      text: getTextLocator(element),
      xpath: createXPath(element),
    };
  }

  function buildRecordedPayload(element, extra) {
    const selectors = getSelectorCandidates(element);
    return {
      ...extra,
      selector: selectors[0] || "",
      selectors,
      locator: buildLocator(element, selectors),
      elementLabel: getTextLocator(element),
      tagName: element?.tagName?.toLowerCase() || "",
    };
  }

  function sendRecordedStep(payload) {
    const now = Date.now();
    chrome.runtime.sendMessage({
      type: "STEP",
      payload: {
        ...payload,
        delay: now - lastTime,
        pageUrl: window.location.href,
        pageTitle: document.title,
      },
    });
    lastTime = now;
  }

  function findByXPath(xpath) {
    if (!xpath) {
      return null;
    }

    try {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue;
    } catch (error) {
      return null;
    }
  }

  function findByText(text) {
    if (!text) {
      return null;
    }

    const normalizedText = text.trim().toLowerCase();
    const candidates = document.querySelectorAll("button, a, label, span, div, input, textarea, select, [role='button']");
    for (const candidate of candidates) {
      const candidateText = (
        candidate.getAttribute("aria-label") ||
        candidate.innerText ||
        candidate.textContent ||
        candidate.value ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      if (candidateText === normalizedText) {
        return candidate;
      }
    }

    return null;
  }

  function selectElement(step) {
    const locator = step.locator || {};

    if (locator.id) {
      const elementById = document.getElementById(locator.id);
      if (elementById) {
        return elementById;
      }
    }

    const cssSelectors = Array.isArray(locator.css) && locator.css.length
      ? locator.css
      : Array.isArray(step.selectors)
        ? step.selectors
        : step.selector
          ? [step.selector]
          : [];

    for (const selector of cssSelectors) {
      try {
        const match = document.querySelector(selector);
        if (match) {
          return match;
        }
      } catch (error) {
        continue;
      }
    }

    if (Array.isArray(locator.data)) {
      for (const attribute of locator.data) {
        try {
          const match = document.querySelector(`[${attribute.name}="${escapeSelectorValue(attribute.value)}"]`);
          if (match) {
            return match;
          }
        } catch (error) {
          continue;
        }
      }
    }

    if (locator.ariaLabel) {
      try {
        const match = document.querySelector(`[aria-label="${escapeSelectorValue(locator.ariaLabel)}"]`);
        if (match) {
          return match;
        }
      } catch (error) {
        // Ignore invalid selector fallback.
      }
    }

    const textMatch = findByText(locator.text || step.elementLabel || "");
    if (textMatch) {
      return textMatch;
    }

    return findByXPath(locator.xpath || "");
  }

  async function waitForElement(step) {
    const timeoutMs = Math.max(1000, Number(step.timeoutMs) || 4000);
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const element = selectElement(step);
      if (element) {
        return element;
      }
      await new Promise((resolve) => setTimeout(resolve, 75));
    }

    return null;
  }

  async function executeActionStep(step) {
    if (step.type === "navigate") {
      window.location.assign(step.value || step.pageUrl || "");
      return { ok: true };
    }

    const element = await waitForElement(step);
    if (!element) {
      return { ok: false, reason: "Element not found before timeout" };
    }

    element.scrollIntoView({ block: "center", behavior: "auto" });
    element.focus?.();

    switch (step.type) {
      case "click": {
        const mouseEventOptions = { bubbles: true, cancelable: true, view: window };
        element.dispatchEvent(new MouseEvent("mouseover", mouseEventOptions));
        element.dispatchEvent(new MouseEvent("mousedown", mouseEventOptions));
        element.dispatchEvent(new MouseEvent("mouseup", mouseEventOptions));
        element.click();
        return { ok: true };
      }
      case "input": {
        const prototype = Object.getPrototypeOf(element);
        const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, "value") : null;
        if (descriptor?.set) {
          descriptor.set.call(element, step.value || "");
        } else {
          element.value = step.value || "";
        }
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return { ok: true };
      }
      default:
        return { ok: false, reason: "Unsupported step type" };
    }
  }

  document.addEventListener(
    "click",
    (event) => {
      const target = getActionableElement(event.target);
      sendRecordedStep(buildRecordedPayload(target, { type: "click" }));
    },
    true
  );

  document.addEventListener(
    "input",
    (event) => {
      const target = getActionableElement(event.target);
      sendRecordedStep(
        buildRecordedPayload(target, {
          type: "input",
          value: event.target?.value ?? "",
        })
      );
    },
    true
  );

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "PING_RECORDER") {
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "EXECUTE_STEP") {
      executeActionStep(message.step).then(sendResponse);
      return true;
    }
  });
}
