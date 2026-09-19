(() => {
  function findMessageRenderTarget(node) {
    const host = node.closest(".F0wyae") || node.closest('[jsname="Ne3sFf"]');
    if (!host) return node;
    return host.querySelector(".EAOoq")
      || host.querySelector(".iKCcE")
      || host.querySelector('[jsname="o7uNDd"]')
      || host.querySelector('[jsname="bgckF"], .DTp27d')
      || host;
  }

  function isMainMessageNode(node) {
    return !node.closest('[data-is-detailed-thread-view="true"]');
  }

  function isTranslatableMessageNode(node) {
    return isMainMessageNode(node) || Boolean(node.closest('[data-is-detailed-thread-view="true"]'));
  }

  function keepSingleMessageSurface(target) {
    const surfaces = [...(target.querySelectorAll?.("[data-tc-surface]") || [])];
    surfaces.slice(1).forEach((surface) => surface.remove());
    return surfaces[0] || null;
  }

  globalThis.TranslateChatMessageSurface = Object.freeze({
    findMessageRenderTarget,
    isMainMessageNode,
    isTranslatableMessageNode,
    keepSingleMessageSurface
  });
})();
