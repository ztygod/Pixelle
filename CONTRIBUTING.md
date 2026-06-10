# Contributing

Thanks for working on Pixelle Agent. This repository is maintained as a
publishable npm package, so changes should preserve the public runtime, tool,
LLM, event, and config contracts unless the change is intentionally breaking.

## Requirements

- Node.js 20 or newer
- pnpm via Corepack

```sh
corepack enable
pnpm install
```

## Development Commands

```sh
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Use `pnpm dev:cli` for the local Ink-based CLI debug entry.

## Commits

This project uses Conventional Commits. Preferred types are:

- `feat`: user-facing capability
- `fix`: bug fix
- `refactor`: behavior-preserving code change
- `docs`: documentation
- `test`: tests
- `chore`: repository maintenance
- `build`: build tooling or dependency changes
- `ci`: GitHub Actions or automation
- `perf`: performance improvement

Use scopes such as `agent`, `tool`, `llm`, `events`, `config`, `cli`, `docs`,
or `release` when they make the commit easier to review.

## Pull Requests

Before opening a PR, run:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For public API changes, include a Changeset:

```sh
pnpm changeset
```

Any change to tool schemas, event payloads, provider adapters, exported types,
or runtime loop behavior should include tests and documentation updates.
