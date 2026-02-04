export interface User {
  id: number;
  username: string;
  name: string;
  avatarUrl?: string | null;
}

export type AuthErrorType = "invalidToken" | "networkError" | "keychainError";

export interface AuthError {
  type: AuthErrorType;
  message?: string;
}

const hasType = (error: unknown): error is { type: unknown } => {
  return typeof error === "object" && error !== null && "type" in error;
};

/**
 * Type guard to check if an error is an AuthError
 */
export const isAuthError = (error: unknown): error is AuthError => {
  if (!hasType(error)) return false;

  return (
    typeof error.type === "string" &&
    ["invalidToken", "networkError", "keychainError"].includes(error.type)
  );
};
