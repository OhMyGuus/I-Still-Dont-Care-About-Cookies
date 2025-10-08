#!/usr/bin/env node

import { program } from "commander";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { formatFile } from "./prettier.js";
import * as acorn from "acorn";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findRulesObject(ast) {
  for (const node of ast.body) {
    if (node.type === "VariableDeclaration" && node.declarations.length > 0) {
      const declarator = node.declarations[0];
      if (
        declarator.id.type === "Identifier" &&
        declarator.id.name === "rules" &&
        declarator.init &&
        declarator.init.type === "ObjectExpression"
      ) {
        return declarator.init;
      }
    }
  }

  console.error('Could not find "const rules = { ... }" in rules.js');
  process.exit(1);
}

function findPropertyByKey(objectExpression, domain) {
  for (const prop of objectExpression.properties) {
    if (prop.type === "Property" && prop.key) {
      const keyValue =
        prop.key.type === "Literal"
          ? prop.key.value
          : prop.key.type === "Identifier"
            ? prop.key.name
            : null;

      if (keyValue === domain) {
        return prop;
      }
    }
  }
  return null;
}

function buildRuleEntry(
  domain,
  css,
  common,
  handler,
  newline = "\n",
  indent = "  "
) {
  const props = {
    ...(handler && { j: handler }),
    ...(common && { c: common }),
    ...(css && { s: JSON.stringify(css) }),
  };

  const keys = Object.entries(props);
  if (keys.length === 0) {
    console.error(
      `No rule properties were provided when updating domain: ${domain}`
    );
    process.exit(1);
  }

  const inner =
    keys.length === 1
      ? `${keys[0][0]}: ${keys[0][1]}`
      : keys.map(([k, v]) => `    ${k}: ${v},`).join(newline);

  return keys.length === 1
    ? `${indent}"${domain}": { ${inner} },`
    : [`${indent}"${domain}": {`, inner, `${indent}},`].join(newline);
}

async function addOrReplaceRule(domain, css, common, handler, skipPrettier) {
  const rulesPath = path.join(__dirname, "..", "src", "data", "rules.js");

  if (!fs.existsSync(rulesPath)) {
    console.error(`Rules file not found at: ${rulesPath}`);
    process.exit(1);
  }

  let content = fs.readFileSync(rulesPath, "utf-8");
  const newline = content.includes("\r\n") ? "\r\n" : "\n";

  const ast = acorn.parse(content, {
    ecmaVersion: "latest",
    sourceType: "module",
  });

  const rulesObject = findRulesObject(ast);
  const existingProperty = findPropertyByKey(rulesObject, domain);
  const cleanCss = css ? css.replace(/\\!/g, "!") : undefined;

  if (existingProperty) {
    console.log(`Replacing existing rule for domain: ${domain}`);

    const start = existingProperty.start;
    const end = existingProperty.end;

    let actualEnd = end;
    if (content[end] === ",") {
      actualEnd = end + 1;
    }

    let lineStart = start - 1;
    while (
      lineStart >= 0 &&
      content[lineStart] !== "\n" &&
      content[lineStart] !== "\r"
    ) {
      lineStart--;
    }
    lineStart++;

    const indentation = content.slice(lineStart, start);
    const entryString = buildRuleEntry(
      domain,
      cleanCss,
      common,
      handler,
      newline,
      indentation
    );

    content =
      content.slice(0, lineStart) + entryString + content.slice(actualEnd);
  } else {
    console.log(`Adding new rule for domain: ${domain}`);

    const insertPosition = rulesObject.end - 1;
    const needsLeadingNewline =
      insertPosition > 0 &&
      content[insertPosition - 1] !== "\n" &&
      content[insertPosition - 1] !== "\r";
    const prefix = needsLeadingNewline ? newline : "";
    const entryString = buildRuleEntry(
      domain,
      cleanCss,
      common,
      handler,
      newline,
      "  "
    );

    content =
      content.slice(0, insertPosition) +
      prefix +
      entryString +
      newline +
      content.slice(insertPosition);
  }

  fs.writeFileSync(rulesPath, content, "utf-8");
  console.log(`Successfully updated rules.js`);

  if (skipPrettier) {
    console.log("Skipping prettier formatting (per --skip-prettier).");
  } else {
    try {
      await formatFile(rulesPath);
    } catch (error) {
      console.error("Error formatting rules.js with prettier:", error);
    }
  }
}

program
  .name("add-rule")
  .description("Add or replace a rule in rules.js")
  .requiredOption("--domain <domain>", "Domain name")
  .option("-s", "--css <css>", "CSS selector rule")
  .option("-c, --common <number>", "Common rule number", parseInt)
  .option("-j, --handler <number>", "Handler number", parseInt)
  .option("--skip-prettier", "Skip prettier formatting")
  .action(async (options) => {
    if (
      !options.css &&
      options.common === undefined &&
      options.handler === undefined
    ) {
      console.error(
        "Error: At least one of --css, --common, or --handler must be provided"
      );
      process.exit(1);
    }
    await addOrReplaceRule(
      options.domain,
      options.css,
      options.common,
      options.handler,
      options.skipPrettier === true
    );
  });

program.parse();
