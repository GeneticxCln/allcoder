# allcoder

Config toolkit CLI for real-world projects: validate, format, convert, merge, and redact JSON/YAML/TOML (+ JSONC/JSON5).

## Install
- Local dev
  ```bash
  npm install
  npm run build
  ```
- Install from GitHub (not published on npm):
  ```bash
  npm i github:GeneticxCln/allcoder#main
  # or
  pnpm add github:GeneticxCln/allcoder#main
  ```

## Usage
```bash
# Validate (auto-detects format from extension unless --format is provided)
allcoder validate config.yaml

# Validate against a JSON Schema
allcoder validate --schema schema.json config.yaml

# Format to stdout
allcoder format -f json config.json

# Check formatting (exit 1 if changes would be made)
allcoder format --check **/*.yaml

# Format in place (supports globs when --write is used)
allcoder format --sort-keys --indent 2 -w "configs/**/*.{json,yaml,yml}"

# Convert between formats (json|jsonc|json5|yaml|toml)
allcoder convert --to yaml config.json > config.yaml

# Merge two YAML files (arrays replaced by default)
allcoder merge -f yaml base.yaml override.yaml > merged.yaml

# Redact sensitive keys, regex, or specific paths
allcoder redact -f json --keys password,token --key-regex "secret|apikey" --paths "users.0.password" secrets.json > redacted.json
```

## Library
```ts
import { parseByFormat, stringifyByFormat, mergeDeep, redact } from "allcoder";
```

## Scripts
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Test: `npm test`
- Coverage: `npm run test:coverage`
- Build: `npm run build`

## License
MIT
