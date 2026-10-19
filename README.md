# reclaim-mac

`reclaim-mac` is a cautious, Git-aware disk space analyzer and cleaner for macOS developer machines.

It finds rebuildable project output, old caches, stale worktree metadata, unavailable simulators, and unused Docker build cache. It explains every candidate, shows its size and risk, and does not remove anything until the user explicitly selects and confirms it.

No telemetry. No daemon. No privileged helper. No `sudo`.

## Install

Node.js 20.10 or newer is required.

```bash
npm install --global github:matheusmacedosantos/reclaim-mac
```

Or with pnpm:

```bash
pnpm add --global github:matheusmacedosantos/reclaim-mac
```

Then run:

```bash
reclaim-mac
```

The default command opens the interactive scanner. Safe candidates start selected; review-level candidates start unselected; blocked candidates cannot be selected.

## Commands

```bash
# Interactive scan, selection, revalidation, and cleanup
reclaim-mac

# Read-only report
reclaim-mac scan

# Machine-readable read-only report
reclaim-mac scan --json

# Add one or more developer roots
reclaim-mac scan --root ~/Projects --root ~/Code

# Do not query external developer tools
reclaim-mac scan --no-docker --no-simulators

# Interactive cleanup after a fresh scan
reclaim-mac clean

# Scripted cleanup of unblocked safe candidates only
reclaim-mac clean --all-safe --yes

# Clean specific IDs from a fresh scan
reclaim-mac clean --id 0123456789 --yes

# Review-level items always require an additional opt-in in scripted mode
reclaim-mac clean --id 0123456789 --include-review --yes
```

The candidate ID is stable for a rule and path, but cleanup still performs a fresh scan and revalidates the path before removal.

## Local configuration

Machine-specific roots and protected paths belong in `~/.config/reclaim-mac/config.json`, never in the repository:

```json
{
  "roots": ["~/Projects"],
  "protectedPaths": [
    "~/Projects/example/unique-source",
    "~/Projects/example/local-state"
  ]
}
```

Every protected path also protects all of its descendants. Set `RECLAIM_MAC_CONFIG` to use a different configuration file. See `config.example.json` for a starter file.

## What it inspects

| Category | Examples | Default risk |
| --- | --- | --- |
| Rust builds | `target` | Safe |
| Next.js builds | `.next` | Safe |
| Local task caches | `.turbo`, `coverage` | Safe |
| Installed Node dependencies | `node_modules` | Review |
| Distribution output | `dist` | Review |
| Agent temporary builds | Generated directories below agent job temp roots | Safe or review |
| Package caches | npm, Yarn, Homebrew | Safe after the age threshold |
| Application caches | Old children of standard user cache directories | Review |
| Xcode | DerivedData and old DeviceSupport | Safe or review |
| Git worktrees | Clean secondary worktrees whose commits are on upstream | Review |
| Docker | Unused builder cache only | Review |
| Simulators | Devices whose runtime is unavailable | Review |

Project roots are discovered from common developer directories. Additional roots can be supplied with `--root`. The scanner has a depth limit and prunes generated or protected trees instead of traversing them.

## Safety model

The safety model is intentionally stricter than a general-purpose file finder.

1. **Scan is read-only.** Running `reclaim-mac scan` never deletes files.
2. **Generated names are not enough.** Git-tracked output is blocked even if its directory is named `dist` or `target`.
3. **Running processes win.** A candidate referenced by a running process is blocked.
4. **Symlinks are never cleanup roots.** This prevents traversal into unexpected locations.
5. **Paths are revalidated.** The cleaner verifies the candidate again immediately before deletion.
6. **Dirty worktrees are blocked.** A worktree is removable only when clean, configured with an upstream, and zero commits ahead of it.
7. **Worktrees use Git.** They are removed with `git worktree remove`, never by recursively deleting their directory.
8. **Docker volumes are out of scope.** The only Docker action is `docker builder prune --force`.
9. **No privilege escalation.** The tool never invokes `sudo`.
10. **Destructive actions require intent.** Interactive cleanup uses selection, a negative-default confirmation, and a typed phrase.

### Always protected

The scanner prunes or rejects paths that represent source, secrets, or persistent state, including:

- `.git`, `.ssh`, `.env*`, private-key formats, keypair and wallet files;
- directories named `keys`, `wallets`, `vendor`, or `extension`;
- `public/circuits`;
- Solana configuration and active agent runtime caches;
- Git worktrees with local changes, untracked files, missing upstreams, or unpushed commits;
- Docker images, containers, networks, volumes, and database data.

Protection is enforced in both the scanner and cleaner.

## Risk levels

- **Safe**: reproducible output with a narrow rule and a clear rebuild path.
- **Review**: reproducible in normal setups, but potentially expensive or inconvenient to recreate.
- **Blocked**: the scanner found evidence that deletion would violate a safety invariant.

`--min-age` sets an additional global age floor. Individual rules may enforce a higher minimum.

## Exit behavior

- A read-only scan exits successfully even when optional tools such as Docker are unavailable; the report contains a warning.
- Scripted cleanup exits non-zero if any selected candidate fails revalidation or cleanup.
- Size values are estimates. APFS clones, sparse files, snapshots, and purgeable space can make physical space recovery differ from the logical total.

## Development

```bash
git clone https://github.com/matheussantos/reclaim-mac.git
cd reclaim-mac
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev
```

The project uses strict TypeScript, ESLint, Vitest, and a CI matrix on current Node.js LTS releases.

## License

MIT
