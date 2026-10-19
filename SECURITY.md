# Security policy

`reclaim-mac` performs destructive filesystem operations only after explicit user intent. A cleanup bug can still cause data loss, so safety issues are treated as security issues.

## Report a vulnerability

Please use GitHub's private vulnerability reporting for this repository. Do not include credentials, private paths, environment files, wallet material, or other secrets in the report.

## Safety invariants

Changes must preserve these invariants:

- read-only commands never mutate the filesystem or external tool state;
- cleanup roots are normalized absolute paths below the current user's home directory;
- symlinks are never accepted as cleanup roots;
- protected path segments and secret-like names are rejected;
- Git-tracked generated directories are rejected;
- dirty, unpushed, detached, or in-use worktrees are rejected;
- Docker cleanup never includes volumes;
- cleanup never requests elevated privileges;
- candidates are revalidated immediately before cleanup;
- shell interpolation is not used for external commands.

Any new cleanup rule must include tests for its allow case and at least one deny case.
