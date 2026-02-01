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

/**
 * Validates GitLab Personal Access Token format.
 * GitLab PATs start with 'glpat-' and are followed by 20 characters (in newer versions).
 * Old tokens were just 20 characters of hex/alphanumeric.
 * We'll check for glpat- prefix OR minimum length of 20.
 */
export const validatePat = (pat: string): boolean => {
  const trimmed = pat.trim();
  if (trimmed.startsWith("glpat-")) {
    return trimmed.length >= 26; // glpat- (6) + 20 chars
  }
  return trimmed.length >= 20;
};
