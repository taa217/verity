// ---------------------------------------------------------------------------
// Error categorization helpers for user-facing error messages
// ---------------------------------------------------------------------------

export interface AppError {
  message: string;
  details?: string;
}

/**
 * Categorise a network-level error (fetch threw) into a user-friendly message.
 */
export function categorizeNetworkError(err: unknown): AppError {
  // No internet / DNS failure / CORS
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return {
      message: "Unable to connect to the server",
      details: "Check your internet connection and try again.",
    };
  }

  // Request was aborted (e.g. timeout)
  if (err instanceof DOMException && err.name === "AbortError") {
    return {
      message: "Request timed out",
      details: "The server took too long to respond. Please try again.",
    };
  }

  return {
    message: "Something went wrong",
    details:
      err instanceof Error
        ? err.message
        : "An unexpected error occurred. Please try again.",
  };
}

/**
 * Categorise an HTTP error (non-2xx status) into a user-friendly message.
 */
export function categorizeHttpError(
  status: number,
  serverDetail?: string,
): AppError {
  if (status === 401 || status === 403) {
    return {
      message: "Session expired",
      details: "Please sign in again to continue.",
    };
  }

  if (status === 429) {
    return {
      message: "Too many requests",
      details:
        "You're sending requests too quickly. Please wait a moment and try again.",
    };
  }

  if (status >= 500) {
    return {
      message: "Server error",
      details:
        serverDetail ||
        "Our servers are having trouble right now. Please try again in a moment.",
    };
  }

  return {
    message: "Request failed",
    details: serverDetail || `The server returned an error (${status}).`,
  };
}
