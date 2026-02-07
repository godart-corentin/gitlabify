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
    return errorType === "invalidToken" ? "Invalid Personal Access Token" : "Authentication failed";  
  }

  if (error instanceof Error) return error.message;
  return "Authentication failed";
};
