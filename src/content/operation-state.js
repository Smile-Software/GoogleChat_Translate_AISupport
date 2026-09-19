(() => {
  function toUserError(error) {
    return {
      code: error?.code || "UNKNOWN",
      message: error?.userMessage || error?.message || "Không thể xử lý",
      retryable: Boolean(error?.retryable)
    };
  }

  async function runUiOperation({ request, onLoading, onSuccess, onError, isCurrent = () => true }) {
    onLoading?.();
    try {
      const value = await request();
      if (!isCurrent()) return { state: "stale", value };
      onSuccess?.(value);
      return { state: "success", value };
    } catch (error) {
      const safeError = toUserError(error);
      if (!isCurrent()) return { state: "stale", error: safeError };
      onError?.(safeError);
      return { state: "error", error: safeError };
    }
  }

  globalThis.TranslateChatOperationState = Object.freeze({ runUiOperation, toUserError });
})();
