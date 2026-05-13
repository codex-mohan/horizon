import { useAuthStore } from "@/stores/auth-store";

export interface SSEMessage {
  id: string;
  event: string;
  data: string;
}

export interface SSEOptions {
  onMessage?: (msg: SSEMessage) => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
}

export function createSSEConnection(
  url: string,
  body: unknown,
  options: SSEOptions
): { close: () => void } {
  const controller = new AbortController();

  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok || !res.body) {
        throw new Error(`SSE connection failed: ${res.status} ${res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let currentId = "";
          let currentEvent = "";
          let currentData = "";

          for (const line of lines) {
            if (line.startsWith("id:")) {
              currentId = line.slice(3).trim();
            } else if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              currentData = line.slice(5).trim();
            } else if (line === "" && currentData !== "") {
              options.onMessage?.({
                id: currentId,
                event: currentEvent || "message",
                data: currentData,
              });
              currentId = "";
              currentEvent = "";
              currentData = "";
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          options.onError?.(err);
        }
      } finally {
        options.onClose?.();
      }
    })
    .catch((err) => {
      if (err instanceof Error && err.name !== "AbortError") {
        options.onError?.(err);
      }
      options.onClose?.();
    });

  return {
    close: () => controller.abort(),
  };
}
