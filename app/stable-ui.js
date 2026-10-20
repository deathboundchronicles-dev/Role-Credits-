(function (root) {
  function controlKey(node) {
    if (node.nodeType !== 1) return "";
    return node.id || node.getAttribute("data-key") || node.getAttribute("data-bind") ||
      node.getAttribute("oninput") || node.getAttribute("onchange") || "";
  }

  function compatible(current, next) {
    return current.nodeType === next.nodeType && current.nodeName === next.nodeName &&
      controlKey(current) === controlKey(next);
  }

  function patchNode(current, next) {
    if (current.nodeType !== 1) {
      if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
      return;
    }
    const active = current === document.activeElement;
    for (const attribute of [...current.attributes]) {
      if (!next.hasAttribute(attribute.name) && !["title", "data-guide-key"].includes(attribute.name) && !(current.matches("details") && attribute.name === "open")) {
        current.removeAttribute(attribute.name);
      }
    }
    for (const attribute of next.attributes) {
      if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
    }
    if (current.matches("input,textarea")) {
      if (!active && current.type !== "file" && current.value !== next.value) current.value = next.value;
      if (current.matches('input[type="checkbox"],input[type="radio"]')) current.checked = next.checked;
      return;
    }
    patchChildren(current, next);
    if (current.matches("select") && current.value !== next.value) current.value = next.value;
  }

  function patchChildren(parent, next) {
    const decorations = [...parent.children].filter(node => node.matches(".guide-badge,.rc-tag-assist"));
    let cursor = parent.firstChild;
    for (const desired of [...next.childNodes]) {
      while (cursor && decorations.includes(cursor)) cursor = cursor.nextSibling;
      if (cursor && compatible(cursor, desired)) {
        patchNode(cursor, desired);
        cursor = cursor.nextSibling;
        continue;
      }
      const key = controlKey(desired);
      const match = key && [...parent.childNodes].find(node => !decorations.includes(node) && compatible(node, desired));
      if (match) {
        parent.insertBefore(match, cursor);
        patchNode(match, desired);
      } else {
        parent.insertBefore(desired.cloneNode(true), cursor);
      }
    }
    while (cursor) {
      const following = cursor.nextSibling;
      if (!decorations.includes(cursor)) cursor.remove();
      cursor = following;
    }
  }

  function preserveView(action) {
    const active = document.activeElement;
    const selection = active && typeof active.selectionStart === "number" ?
      [active.selectionStart, active.selectionEnd, active.selectionDirection] : null;
    const scrolls = [];
    for (let ancestor = active; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
      if (ancestor.scrollHeight > ancestor.clientHeight || ancestor.scrollWidth > ancestor.clientWidth) {
        scrolls.push([ancestor, ancestor.scrollLeft, ancestor.scrollTop]);
      }
    }
    const left = window.scrollX, top = window.scrollY;
    const result = action();
    if (active?.isConnected && document.activeElement !== active) active.focus({ preventScroll: true });
    if (selection && active?.isConnected) {
      try { active.setSelectionRange(...selection); } catch {}
    }
    for (const [element, xPosition, yPosition] of scrolls) {
      element.scrollLeft = xPosition;
      element.scrollTop = yPosition;
    }
    if (window.scrollX !== left || window.scrollY !== top) window.scrollTo({ left, top, behavior: "instant" });
    return result;
  }

  root.rcPatchHTML = function (element, markup) {
    if (!element) return;
    return preserveView(() => {
      const template = document.createElement("template");
      template.innerHTML = markup;
      patchChildren(element, template.content);
    });
  };
  root.rcPreserveView = preserveView;
})(globalThis);
