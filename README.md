# blessMeter

Two versions of a StreamElements widget for tracking number of blesses, curses, and blurses redeemed in twitch chat.

[Version 1 Widget README.md](./v1/README.md) - A FFVI menu inspired 3 meter display for tracking blesses, curses, and blurses.

[Version 2 Widget README.md](./v2/README.md) - A vertical meter display for tracking blesses, curses, and blurses.

Final Fantasy and all other trademarked material is the intellectual property of Square Enix.

## CI and branch protection

Pull requests and pushes to **`main`** and **`develop`** run the test suite via [GitHub Actions](.github/workflows/ci.yml) (`npm ci` + `npm test`).

Repository **rulesets** (required passing `test` check + one PR approval) are defined in [.github/rulesets/](.github/rulesets/). Apply them once per repo with a `GITHUB_TOKEN` that has admin access:

```bash
npm run rulesets:apply
```

See [.github/rulesets/README.md](.github/rulesets/README.md) for bypass behavior (the repository owner can merge without a reviewer; CI still must pass).
