// This is used to generate the block rules for Manifest V3 from the block rules in Manifest V2.

import { blockUrls } from "../src/data/rules.js";
import { pathToFileURL } from "url";

export function generateDeclarativeNetRules(source = blockUrls) {
  const result = [];
  let lastId = 1;

  const addRule = (blockRule) => {
    const newRule = {
      id: lastId++,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: blockRule.r,
        resourceTypes: ["script", "stylesheet", "xmlhttprequest", "image"],
      },
    };

    if (blockRule.e) {
      newRule.condition.excludedInitiatorDomains = blockRule.e.slice();
    }

    result.push(newRule);
  };

  const addSpecificRule = (domain, url) => {
    result.push({
      id: lastId++,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: url,
        resourceTypes: ["script", "stylesheet", "xmlhttprequest", "image"],
        initiatorDomains: [domain],
      },
    });
  };

  for (const blockRule of source.common) {
    addRule(blockRule);
  }

  for (const blockRules of Object.values(source.common_groups)) {
    for (const blockRule of blockRules) {
      addRule(blockRule);
    }
  }

  const additionalSpecificRules = [];
  for (const [domain, urls] of Object.entries(source.specific)) {
    addSpecificRule(domain, urls[0]);
    additionalSpecificRules.push(...urls.slice(1).map((url) => [domain, url]));
  }

  // Keep existing IDs stable and append filters that the old generator skipped.
  for (const [domain, url] of additionalSpecificRules) {
    addSpecificRule(domain, url);
  }

  return result;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  console.log(JSON.stringify(generateDeclarativeNetRules(), null, "\t"));
}
