import { describe, it, expect } from "vitest";
import { validateGitlabUrl, validatePat } from "./validation";

describe("validateGitlabUrl", () => {
  it("should return true for valid https URLs", () => {
    expect(validateGitlabUrl("https://gitlab.com")).toBe(true);
    expect(validateGitlabUrl("https://gitlab.mycompany.com/api/v4")).toBe(true);
  });

  it("should return true for valid http URLs", () => {
    expect(validateGitlabUrl("http://localhost:8080")).toBe(true);
  });

  it("should return false for invalid URLs", () => {
    expect(validateGitlabUrl("not-a-url")).toBe(false);
    expect(validateGitlabUrl("gitlab.com")).toBe(false); // Missing protocol
  });

  it("should return false for unsupported protocols", () => {
    expect(validateGitlabUrl("ftp://gitlab.com")).toBe(false);
    expect(validateGitlabUrl("ssh://git@gitlab.com")).toBe(false);
  });
});

describe("validatePat", () => {
  it("should return true for valid new-style glpat- tokens", () => {
    expect(validatePat("glpat-12345678901234567890")).toBe(true);
  });

  it("should return true for valid old-style tokens (20+ chars)", () => {
    expect(validatePat("12345678901234567890")).toBe(true);
  });

  it("should return false for too short glpat- tokens", () => {
    expect(validatePat("glpat-short")).toBe(false);
  });

  it("should return false for too short old tokens", () => {
    expect(validatePat("too-short")).toBe(false);
  });

  it("should handle whitespace", () => {
    expect(validatePat("  glpat-12345678901234567890  ")).toBe(true);
  });
});
