import { parseAuthError } from "./readAuthError";

export const isInvalidTokenError = (error: unknown) => {
  const parsed = parseAuthError(error);
  return parsed?.type === "invalidToken";
};

export const isInsufficientScopeError = (error: unknown) => {
  const parsed = parseAuthError(error);
  return parsed?.type === "insufficientScope";
};
