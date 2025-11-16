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

function findGetEFunction(ast) {
  for (const node of ast.body) {
    if (node.type === "FunctionDeclaration" && node.id.name === "getE") {
      return node;
    }
  }
  console.error('Could not find "getE" function in 6_cookieHandler.js');
  process.exit(1);
}

function findSwitchStatement(getEFunction) {
  // The switch statement should be in the function body
  for (const stmt of getEFunction.body.body) {
    if (stmt.type === "SwitchStatement") {
      return stmt;
    }
  }
  console.error('Could not find switch statement in getE function');
  process.exit(1);
}

function cookiesArraysEqual(cookies1, cookies2) {
  if (cookies1.length !== cookies2.length) return false;
  const sorted1 = [...cookies1].sort();
  const sorted2 = [...cookies2].sort();
  return sorted1.every((val, idx) => val === sorted2[idx]);
}

function extractCookiesFromCase(caseNode) {
  // Find the return statement in this case
  for (const stmt of caseNode.consequent) {
    if (stmt.type === "ReturnStatement" && stmt.argument) {
      if (stmt.argument.type === "ArrayExpression") {
        // Extract cookie strings from the array
        return stmt.argument.elements.map(elem => {
          if (elem.type === "Literal") {
            return elem.value;
          }
          return null;
        }).filter(Boolean);
      }
    }
  }
  return null;
}

function findCaseForCookies(switchStatement, cookies) {
  // Look through all cases to see if any have the exact same cookies
  for (const caseNode of switchStatement.cases) {
    if (caseNode.test) {  // Skip default case
      const caseCookies = extractCookiesFromCase(caseNode);
      if (caseCookies && cookiesArraysEqual(caseCookies, cookies)) {
        return caseNode;
      }
    }
  }
  return null;
}

function buildCookieCase(domain, cookies, indent = "  ") {
  // Use JSON.stringify to properly escape quotes and special characters
  const cookieArray = cookies.map(c => JSON.stringify(c)).join(", ");
  return `${indent}case "${domain}":\n${indent}  return [${cookieArray}];\n`;
}

async function addOrReplaceCookieRule(domain, cookies, skipPrettier) {
  const cookieHandlerPath = path.join(__dirname, "..", "src", "data", "js", "6_cookieHandler.js");

  if (!fs.existsSync(cookieHandlerPath)) {
    console.error(`Cookie handler file not found at: ${cookieHandlerPath}`);
    process.exit(1);
  }

  let content = fs.readFileSync(cookieHandlerPath, "utf-8");
  const newline = content.includes("\r\n") ? "\r\n" : "\n";

  const ast = acorn.parse(content, {
    ecmaVersion: "latest",
    sourceType: "module",
  });

  const getEFunction = findGetEFunction(ast);
  const switchStatement = findSwitchStatement(getEFunction);

  // Check if this exact cookie set already exists in another case
  const existingCaseWithCookies = findCaseForCookies(switchStatement, cookies);

  if (existingCaseWithCookies) {
    // Add domain to existing case group
    console.log(`Found existing case with same cookies, adding domain to group`);

    const caseStart = existingCaseWithCookies.start;

    // Find the start of the line
    let lineStart = caseStart - 1;
    while (lineStart >= 0 && content[lineStart] !== "\n" && content[lineStart] !== "\r") {
      lineStart--;
    }
    lineStart++;

    const indentation = content.slice(lineStart, caseStart);
    const newCaseLine = `${indentation}case "${domain}":${newline}`;

    content = content.slice(0, lineStart) + newCaseLine + content.slice(lineStart);
  } else {
    // Create new case at the bottom (before the closing brace of switch)
    console.log(`Adding new cookie case for domain: ${domain}`);

    // Insert before the closing brace of the switch statement
    // The switch statement's end position is right after the closing '}'
    // We need to find the closing '}' and insert before it
    let switchEnd = switchStatement.end - 1; // Position of the closing '}'

    // Find the position after any whitespace/newlines before the '}'
    let insertPosition = switchEnd;
    while (insertPosition > 0 && (content[insertPosition - 1] === ' ' || content[insertPosition - 1] === '\t')) {
      insertPosition--;
    }
    // Now we're at the first non-space character before whitespace before '}'
    // We want to insert after the last newline before the '}'
    while (insertPosition > 0 && content[insertPosition - 1] !== '\n' && content[insertPosition - 1] !== '\r') {
      insertPosition--;
    }

    const caseString = buildCookieCase(domain, cookies, "    ");

    content = content.slice(0, insertPosition) + caseString + content.slice(insertPosition);
  }

  fs.writeFileSync(cookieHandlerPath, content, "utf-8");
  console.log(`Successfully updated 6_cookieHandler.js`);

  if (skipPrettier) {
    console.log("Skipping prettier formatting (per --skip-prettier).");
  } else {
    try {
      await formatFile(cookieHandlerPath);
    } catch (error) {
      console.error("Error formatting 6_cookieHandler.js with prettier:", error);
    }
  }
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

    let insertPosition = rulesObject.end - 1;

    // Look for "// end of const rules" comment before the closing brace
    const beforeClosing = content.slice(0, insertPosition);
    const endCommentMatch = beforeClosing.match(
      /\n\s*\/\/\s*end of const rules\s*\n/
    );

    if (endCommentMatch) {
      // Insert before the comment instead of after it
      insertPosition = endCommentMatch.index + 1; // +1 to keep the newline before comment
    }

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
  .description("Add or replace a rule in rules.js and optionally add cookie rules to 6_cookieHandler.js")
  .requiredOption("--domain <domain>", "Domain name")
  .option("-s, --css <css>", "CSS selector rule")
  .option("-c, --common <number>", "Common rule number", parseInt)
  .option("-j, --handler <number>", "Handler number", parseInt)
  .option("--cookie <name=value>", "Cookie rule (can be specified multiple times)", (value, previous) => {
    // Validate cookie format
    if (!value.includes("=")) {
      console.error(`Error: Cookie must be in format "name=value", got: ${value}`);
      process.exit(1);
    }
    return previous ? [...previous, value] : [value];
  }, [])
  .option("--skip-prettier", "Skip prettier formatting")
  .action(async (options) => {
    const hasCookies = options.cookie && options.cookie.length > 0;

    if (
      !options.css &&
      options.common === undefined &&
      options.handler === undefined &&
      !hasCookies
    ) {
      console.error(
        "Error: At least one of --css, --common, --handler, or --cookie must be provided"
      );
      process.exit(1);
    }

    // If cookies are provided, add them to 6_cookieHandler.js
    if (hasCookies) {
      console.log(`Adding cookie rules for domain: ${options.domain}`);
      await addOrReplaceCookieRule(options.domain, options.cookie, options.skipPrettier === true);

      // Automatically add handler reference to rules.js
      // Use handler 6 (cookie handler) if not already specified
      const handlerToUse = options.handler !== undefined ? options.handler : "6";
      await addOrReplaceRule(
        options.domain,
        options.css,
        options.common,
        handlerToUse,
        options.skipPrettier === true
      );
    } else {
      // No cookies, just update rules.js as before
      await addOrReplaceRule(
        options.domain,
        options.css,
        options.common,
        options.handler,
        options.skipPrettier === true
      );
    }
  });

program.parse();
