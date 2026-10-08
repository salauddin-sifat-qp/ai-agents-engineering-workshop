import { editFileSchema } from "./editTool.ts";
import { executeAnythingSchema } from "./badTool.ts";
import { writeFileSchema } from "./naiveWrite.ts";
import type { ToolKind } from "./registry.ts";
import { listFilesSchema, readFileSchema, runTestsSchema, searchCodeSchema } from "./tools.ts";

console.log("Bad tool schema (one opaque string, no classification):");
console.log(JSON.stringify(executeAnythingSchema, null, 2));

const goodTools: [string, ToolKind, string][] = [
  [searchCodeSchema.name, "read", searchCodeSchema.description],
  [readFileSchema.name, "read", readFileSchema.description],
  [listFilesSchema.name, "read", listFilesSchema.description],
  [runTestsSchema.name, "execute", runTestsSchema.description],
];

console.log("\nGood tool schemas (narrow, typed, classified):");
for (const [name, kind, description] of goodTools) {
  console.log(`- ${name} [${kind}]: ${description}`);
}

console.log("\nTwo write tools, same job, very different risk:");
console.log(`- ${writeFileSchema.name} [write]: ${writeFileSchema.description}`);
console.log(`- ${editFileSchema.name} [write]: ${editFileSchema.description}`);
console.log("\nRun them:  pnpm 05:naive   then   pnpm 05:edit");
