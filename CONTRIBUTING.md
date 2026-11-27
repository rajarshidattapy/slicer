# Contributing to Slicer

Thanks for your interest in Slicer! Bug reports, ideas, platform adapters and
pull requests are all welcome. This guide explains how the repo is laid out and
what we expect from a contribution.

## Repository layout

| Path | What it is | Stack |
|:--|:--|:--|
| `app/` | Comparison backend, scrapers and web frontend | Python (FastAPI, Playwright), React + Vite (pnpm) |
| `swiggy-cli/` | Terminal client that drives Swiggy in the user's own Chrome | Node.js 22+, chrome-devtools-mcp |
| `zomato-cli/` | Terminal client for Zomato, District and Blinkit | Node.js 22+, playwright-core |
| `rea/` | Reverse-engineering research notes for platform adapters | Markdown |
| `docs/` | Product and feature documentation | Markdown |

## Getting set up

### Backend (`app/`)

```bash
cd app
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
uvicorn api.main:app --reload
```

Run the tests from inside `app/`:

```bash
python -m unittest discover tests
```

Or run everything in Docker:

```bash
cd app
docker compose up --build
```

### Frontend (`app/frontend/`)

```bash
cd app/frontend
pnpm install
pnpm dev          # local dev server
pnpm lint         # oxlint
pnpm build        # type-check + production build
```

### CLIs (`swiggy-cli/`, `zomato-cli/`)

```bash
cd swiggy-cli     # or zomato-cli
npm install
npm test          # unit tests (node --test)
npm run check     # syntax check
npm link          # optional: put the command on your PATH
```

See each CLI's `README.md` for setup steps such as enabling Chrome remote
debugging.

## Making a change

1. **Open an issue first** for anything bigger than a small fix, so we can agree
   on the approach before you spend time on it. Known CLI problems are tracked
   in each CLI's `issues.md`.
2. **Fork and branch** from `master`. Use a descriptive branch name, for example
   `fix/swiggy-waf-allowlist` or `feat/zomato-order-history`.
3. **Keep changes focused.** One logical change per pull request is much easier
   to review than a bundle of unrelated edits.
4. **Add or update tests.** Parsers and scoring logic should have unit tests
   that use saved, anonymised samples, not live network calls.
5. **Run the checks** for every part you touched (see above) and make sure they
   pass.
6. **Update docs.** If you add a command, flag, endpoint or environment
   variable, document it in the relevant `README.md`.
7. **Open a pull request** that explains *what* changed and *why*, how you
   tested it, and links the related issue.

### Commit messages

Write short, imperative subject lines (`Add Blinkit search parser`, not
`added stuff`). Add a body when the reason for the change isn't obvious.

### Code style

- **JavaScript:** ES modules, `const`/`let`, async/await, no new runtime
  dependencies without discussion. Prefer accessibility and `data-testid`
  selectors over generated CSS class names.
- **Python:** follow PEP 8, add type hints to new functions, keep scraper logic
  inside `app/scraper/` and matching or scoring logic inside `app/api/`.
- **TypeScript/React:** keep `pnpm lint` and `pnpm build` clean.

## Platform adapters: ground rules

Slicer works with third-party delivery platforms, so adapters must respect
users and platforms:

- **Never extract, log, copy or commit** cookies, auth tokens, OTPs, addresses,
  payment details or any other personal data. Scrub HAR files, screenshots and
  fixtures before you commit them.
- **Never automate order placement or payment.** The user must complete
  checkout themselves.
- **Don't bypass** bot protection, CAPTCHAs, rate limits or browser consent
  prompts.
- **Be gentle:** cache where possible and avoid aggressive polling.
- Follow each platform's terms of service and applicable law.

Pull requests that break these rules will not be merged.

## Reporting bugs

Open an issue that includes:

- what you ran (command, endpoint or page) and what you expected to happen
- what actually happened, with error output (redact anything personal)
- OS, Node/Python version, and Chrome version for the CLIs
- the date you observed it, because platform websites change often

## Security

Please don't report security problems in public issues. Contact the maintainer
privately through their GitHub profile instead.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
