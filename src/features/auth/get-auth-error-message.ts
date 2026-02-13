import { AuthErrorSchema } from "../../schemas";

type GetAuthErrorMessageArgs = {
  validationError: string | null;
  authError: unknown;
  verifyError: unknown;
};

export const getAuthErrorMessage = ({
  validationError,
  authError,
  verifyError,
}: GetAuthErrorMessageArgs) => {
  if (validationError !== null) return validationError;

  const error = authError || verifyError;
  if (!error) return null;

  const judgmentResult = AuthErrorSchema.tryJudge(error);

  if (judgmentResult.type === "success") {
    const errorType = judgmentResult.data.type;
    if (errorType === "invalidToken") {
      return "Invalid Personal Access Token";
    }
    if (errorType === "insufficientScope") {
      return (
        judgmentResult.data.message ||
        "Token permissions are insufficient. Required scopes include api/read_api and read_user."
      );
    }
    return "Authentication failed";
  }

  if (error instanceof Error) return error.message;
  return "Authentication failed";
};
