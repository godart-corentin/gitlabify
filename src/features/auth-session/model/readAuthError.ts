export type ParsedAuthError = {
  type: "invalidToken" | "insufficientScope" | "networkError" | "keychainError";
  message?: string;
};

const AUTH_ERROR_TYPES = new Set([
  "invalidToken",
  "insufficientScope",
  "networkError",
  "keychainError",
]);

const isAuthErrorType = (value: string): value is ParsedAuthError["type"] => {
  return AUTH_ERROR_TYPES.has(value);
};

export const parseAuthError = (error: unknown): ParsedAuthError | null => {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as { type?: unknown; message?: unknown };
  if (typeof candidate.type !== "string" || !isAuthErrorType(candidate.type)) {
    return null;
  }

  return {
    type: candidate.type,
    message: typeof candidate.message === "string" ? candidate.message : undefined,
  };
};
