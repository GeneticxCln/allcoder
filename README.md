# allcoder

Config toolkit CLI for real-world projects: validate, format, convert, merge, and redact JSON/YAML/TOML.

## Install
- Local dev
  ```bash
  npm install
  npm run build
  ```
- Use via npx (after publish):
  ```bash
  npx allcoder --help
  ```

## Usage
```bash
# Validate (detects format from extension unless --format is provided)
allcoder validate config.yaml

# Format to stdout
allcoder format -f json config.json

# Format in place with sorted keys
allcoder format --sort-keys -w config.yaml

# Convert
allcoder convert --to yaml config.json > config.yaml

# Merge two YAML files (arrays replaced by default)
allcoder merge -f yaml base.yaml override.yaml > merged.yaml

# Redact sensitive keys
allcoder redact -f json --keys password,token secrets.json > redacted.json
```

## Library
```ts
import { parseByFormat, stringifyByFormat, mergeDeep, redact } from "allcoder";
```

## Scripts
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Test: `npm test`
- Build: `npm run build`

## License
MIT
