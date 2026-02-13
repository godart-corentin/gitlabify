import { obj, str, num, union, lit, optional, nullable, type ExtractValidatorType } from "sibyl-ts";

export const UserSchema = obj({
  id: num(),
  username: str(),
  name: str(),
  avatarUrl: nullable(str()),
});

export type User = ExtractValidatorType<typeof UserSchema>;

export const AuthorSchema = UserSchema;
export type Author = User;

export const AuthErrorTypeSchema = union([
  lit("invalidToken"),
  lit("insufficientScope"),
  lit("networkError"),
  lit("keychainError"),
]);

export type AuthErrorType = ExtractValidatorType<typeof AuthErrorTypeSchema>;

export const AuthErrorSchema = obj({
  type: AuthErrorTypeSchema,
  message: optional(str()),
});

export type AuthError = ExtractValidatorType<typeof AuthErrorSchema>;
