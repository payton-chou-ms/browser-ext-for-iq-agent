## Release Notes Addendum

This release publishes two separate assets:

- `iq-copilot-extension-<ref>-<sha6>.zip` for the Edge extension itself
- `iq-copilot-local_proxy-<ref>-<sha6>.zip` for the local backend proxy package

The `local_proxy` package includes:

- `dist/proxy.js`
- `start.sh`
- runtime install metadata (`package.json`, `package-lock.json`)
- `.github/skills/foundry_agent_skill/`
- `.github/skills/gen-img/`

Recommended setup:

1. Extract the `local_proxy` package.
2. Run `./start.sh` inside that directory.
3. Load the Edge extension package in the browser.
4. Let the extension connect to `http://127.0.0.1:8321`.

If you only download the extension package, the WorkIQ, Foundry, and Copilot SDK flows will not work end to end.

If a Python skill package does not include `.venv/`, create the environment from the skill-local `requirements.txt` before running the skill directly.