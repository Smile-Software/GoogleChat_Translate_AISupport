(() => {
  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  const externalUserStatus = /(?:Người dùng bên ngoài không do quản trị viên quản lý|External user not managed by admin|domain_disabled)/gi;
  const chatTimestamp = /(?:^|[\n,])\s*(?:(?:hôm qua|yesterday|hôm nay|today)\s+)?\d{1,2}:\d{2}\s*(?=[,\n]|$)/giu;

  function translateChatCleanMessageText(raw, { author = "", time = "" } = {}) {
    let text = String(raw || "").replace(/\u00a0/g, " ");
    text = text.replace(externalUserStatus, " ");
    if (author) {
      text = text.replace(new RegExp("(?:^|[\\n,])\\s*" + escapeRegExp(author) + "\\s*(?=[,\\n]|$)", "g"), " ");
    }
    if (time) text = text.replace(new RegExp("\\s*" + escapeRegExp(time) + "\\s*$", "g"), "");
    text = text.replace(chatTimestamp, " ");
    text = text.replace(/,?\s*\d+\s+(?:tin nhắn trả lời|replies?)\b.*$/giu, "");
    return text.replace(/\s+/g, " ").replace(/^[,\s]+|[,\s]+$/g, "").trim();
  }

  globalThis.TranslateChatMessageText = Object.freeze({ cleanMessageText: translateChatCleanMessageText });
})();
