import * as fs from "fs";
import * as prettier from "prettier";

/**
 * Format a file using Prettier
 * @param {string} filePath - Absolute path to the file to format
 * @returns {Promise<void>}
 */
export async function formatFile(filePath) {
  try {
    console.log("Formatting with prettier...");
    const content = fs.readFileSync(filePath, "utf-8");
    const options = await prettier.resolveConfig(filePath);
    const formatted = await prettier.format(content, {
      ...options,
      filepath: filePath,
    });
    fs.writeFileSync(filePath, formatted, "utf-8");
    console.log("Prettier formatting complete");
  } catch (error) {
    console.error("Warning: Failed to format with prettier:", error.message);
    throw error;
  }
}
