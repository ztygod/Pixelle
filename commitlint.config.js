export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "refactor",
        "docs",
        "test",
        "chore",
        "build",
        "ci",
        "perf",
        "revert",
      ],
    ],
    "scope-enum": [
      1,
      "always",
      ["agent", "tool", "llm", "events", "config", "cli", "docs", "release"],
    ],
  },
};
