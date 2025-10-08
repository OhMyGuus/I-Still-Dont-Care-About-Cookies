# Tools

This folder contains utility scripts for managing the I Still Don't Care About Cookies extension.

## Available Tools

### add-rule.js

Adds or replaces cookie consent rules in `src/data/rules.js`. Automatically formats the file with Prettier after making changes.

**Usage:**

```bash
npm run add-rule -- --domain <domain> [options]
```

**Options:**

- `--domain <domain>` (required) - The domain name
- `--css <css>` - CSS selector rule (s property)
- `-c, --common <number>` - Common rule number (c property)
- `-j, --handler <number>` - Handler number (j property)
  - `0` - Default click handler
  - `2` - Session storage handler
  - `3` - Local storage handler
  - `5` - Click handler
  - `6` - Cookie handler
  - `8` - Google handler

At least one of `--css`, `--common`, or `--handler` must be provided.

**Examples:**

```bash
# Add a CSS rule
npm run add-rule -- --domain 'example.com' --css '.cookie-banner{display:none !important}'

# Add a common rule
npm run add-rule -- --domain 'example.com' --common 5

# Add a handler
npm run add-rule -- --domain 'example.com' --handler 5

# Add multiple properties
npm run add-rule -- --domain 'example.com' --handler 5 --common 10 --css '.banner{display:none}'
```

### generate-block-rules.js

Generates Manifest V3 declarative net rules from the block rules defined in `src/data/rules.js`. Outputs to `src/rules.json` and automatically formats with Prettier.

**Usage:**

```bash
npm run generate-block-rules
```

This script:

1. Reads block rules from `src/data/rules.js`
2. Converts them to Manifest V3 format
3. Writes the output to `src/rules.json`
4. Formats the file with Prettier
