function endpoint(baseUrl, path) {
  return new URL(path, baseUrl.replace(/\/+$/, "") + "/").toString();
}

export class ProviderError extends Error {
  constructor(message, { code, status = 0, retryable = false, userMessage = message, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "ProviderError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.userMessage = userMessage;
  }
}

function errorForStatus(status) {
  if (status === 401 || status === 403) {
    return { code: "AUTH", retryable: false, userMessage: "Provider authentication failed. Check the API key." };
  }
  if (status === 429) {
    return { code: "RATE_LIMIT", retryable: true, userMessage: "Provider rate limit reached. Try again later." };
  }
  if (status >= 500) {
    return { code: "SERVER", retryable: true, userMessage: "Provider server error. Try again." };
  }
  return { code: "HTTP_ERROR", retryable: false, userMessage: "Provider request failed." };
}

export function classifyProviderError(error) {
  if (error instanceof ProviderError) return error;
  if (error?.name === "AbortError") {
    return new ProviderError("Provider request timed out", {
      code: "TIMEOUT",
      retryable: true,
      userMessage: "Provider request timed out. Try again."
    });
  }
  return new ProviderError("Provider network request failed", {
    code: "NETWORK",
    retryable: true,
    userMessage: "Cannot reach the provider. Check the connection and try again.",
    cause: error
  });
}

async function requestJson(url, init, timeoutMs, fetchImpl = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const raw = await response.text();
    let body = null;
    let malformed = false;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      malformed = true;
    }
    if (!response.ok) {
      const classification = errorForStatus(response.status);
      throw new ProviderError("Provider returned HTTP " + response.status, { ...classification, status: response.status });
    }
    if (malformed || body === null) {
      throw new ProviderError("Provider response was not valid JSON", {
        code: "MALFORMED_RESPONSE",
        retryable: false,
        userMessage: "Provider returned an invalid response."
      });
    }
    return body;
  } catch (error) {
    throw classifyProviderError(error);
  } finally {
    clearTimeout(timer);
  }
}

export { requestJson };

export async function listModels(settings, fetchImpl = fetch) {
  const body = await requestJson(endpoint(settings.baseUrl, "models"), {
    headers: { Authorization: "Bearer " + settings.apiKey }
  }, settings.requestTimeoutMs, fetchImpl);
  if (!Array.isArray(body?.data)) {
    throw new ProviderError("Provider model response was invalid", {
      code: "MALFORMED_RESPONSE",
      retryable: false,
      userMessage: "Provider returned an invalid model list."
    });
  }
  const ids = body.data.map((item) => typeof item?.id === "string" ? item.id.trim() : "").filter(Boolean);
  return [...new Set(ids)].sort((a, b) => {
    const luna = Number(/luna/i.test(b)) - Number(/luna/i.test(a));
    return luna || a.localeCompare(b);
  });
}

export async function chatCompletion(settings, messages, fetchImpl = fetch) {
  const body = await requestJson(endpoint(settings.baseUrl, "chat/completions"), {
    method: "POST",
    headers: {
      Authorization: "Bearer " + settings.apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model: settings.model, messages, temperature: 0.2 })
  }, settings.requestTimeoutMs, fetchImpl);
  const content = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new ProviderError("Provider response missing content", {
      code: "MALFORMED_RESPONSE",
      retryable: false,
      userMessage: "Provider returned no usable content."
    });
  }
  return content.trim();
}

export function buildTranslationMessages(text, sourceLanguage, targetLanguage) {
  return [
    { role: "system", content: "Translate message to " + targetLanguage + ". Preserve meaning, names, URLs, line breaks, and tone. Return translation only." },
    { role: "user", content: "Source language: " + sourceLanguage + ". Message:\n" + text }
  ];
}

export function buildSummaryMessages(messages, targetLanguage, length, previousSummary = "") {
  const joined = messages.map((item) => "[" + item.author + " " + item.time + "] " + item.text).join("\n");
  const prior = previousSummary ? "Previous summary:\n" + previousSummary + "\n\n" : "";
  return [
    { role: "system", content: "Summarize Google Chat thread in " + targetLanguage + ". Length: " + length + ". Include decisions, owners, blockers, and next actions. Return summary only." },
    { role: "user", content: prior + "Thread messages:\n" + joined }
  ];
}
