import assert from "node:assert/strict";
import test from "node:test";
import { buildRuleEntry } from "./add-rule.js";
import { generateDeclarativeNetRules } from "./generate-block-rules.js";

test("buildRuleEntry preserves zero-valued rule references", () => {
  assert.equal(
    buildRuleEntry("example.com", undefined, undefined, 0),
    '  "example.com": { j: 0 },'
  );
  assert.equal(
    buildRuleEntry("example.com", undefined, 0, undefined),
    '  "example.com": { c: 0 },'
  );
});

test("generateDeclarativeNetRules emits every site-specific URL", () => {
  const generated = generateDeclarativeNetRules({
    common: [],
    common_groups: {},
    specific: {
      "example.com": ["first-filter", "second-filter"],
      "another.example": ["another-filter"],
    },
  });

  assert.deepEqual(
    generated.map(({ id, condition }) => ({ id, ...condition })),
    [
      {
        id: 1,
        urlFilter: "first-filter",
        resourceTypes: ["script", "stylesheet", "xmlhttprequest", "image"],
        initiatorDomains: ["example.com"],
      },
      {
        id: 2,
        urlFilter: "another-filter",
        resourceTypes: ["script", "stylesheet", "xmlhttprequest", "image"],
        initiatorDomains: ["another.example"],
      },
      {
        id: 3,
        urlFilter: "second-filter",
        resourceTypes: ["script", "stylesheet", "xmlhttprequest", "image"],
        initiatorDomains: ["example.com"],
      },
    ]
  );
});
