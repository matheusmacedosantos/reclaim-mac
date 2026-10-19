# Contributing

Contributions are welcome, especially new narrowly scoped scanners and platform-safety tests.

## Before opening a pull request

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Adding a cleanup rule

A rule must document:

1. why the data is reproducible;
2. which application recreates it;
3. the minimum age and risk level;
4. all protected ancestors or conflicting cases;
5. how the cleaner revalidates it;
6. an allow test and a deny test.

Avoid broad globs, shell command strings, `sudo`, force-removing Git worktrees, or cleanup operations that include user-created data.
