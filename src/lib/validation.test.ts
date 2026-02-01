import { describe, it, expect } from "vitest";
import { validateGitlabUrl } from "./validation";

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
