# Contributing to Pixora

Thanks for taking the time to improve Pixora.

## Before you start

- Read the project overview in [README.md](README.md).
- Read the architecture boundaries in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- Search existing issues before opening a new one.

## Development setup

Requirements: Node.js 20.19+ (Node 22 is used in CI).

```bash
npm ci
npm run dev
```

The web app runs at <http://localhost:5173>. The optional API runs at
<http://localhost:3001>.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run web and API development servers |
| `npm run dev:web` | Run the web app only |
| `npm run dev:api` | Run the API only |
| `npm run typecheck` | TypeScript checks for both workspaces |
| `npm run build` | Production builds for both workspaces |
| `npm run preview:web` | Preview the production web build |

## Project conventions

- Keep the MVC boundaries described in `docs/ARCHITECTURE.md`.
- Views render data and emit events. Do not call `fetch` or IndexedDB from Vue components.
- Controllers coordinate state and actions.
- Services contain image processing, export, storage and HTTP concerns.
- Models describe domain types and static options.
- Keep processing local-first unless a change explicitly introduces a backend feature.
- Add concise comments only where the reason for the code is not obvious.
- Do not commit generated output, local environment files, personal paths or user data.

## Pull requests

Before opening a PR:

1. Keep the change focused on one problem.
2. Run `npm run typecheck` and `npm run build`.
3. Test the affected flow in a browser.
4. Include screenshots for visible UI changes.
5. Update documentation or screenshots when behavior changes.

By contributing, you agree that your contribution is licensed under the
project's [MIT License](LICENSE).
