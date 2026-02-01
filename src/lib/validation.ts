/**
 * Validates if a string is a valid HTTP or HTTPS URL.
 */
export const validateGitlabUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};
