#!/usr/bin/node

import fs from "node:fs";
import crypto from "node:crypto";
import { stripVTControlCharacters } from "node:util";

const convertJsonToCtrf = (inputReport) => {
  const report = {
    reportFormat: "CTRF",
    specVersion: "0.0.0",
    reportId: crypto.randomUUID(),
    timestamp: new Date(
      Date.parse(inputReport.stats.startTime) + inputReport.stats.duration
    ).toISOString(),
    generatedBy: "convert-json-to-ctrf",
    results: {
      tool: {
        name: "convert-json-to-ctrf",
      },
      summary: {
        tests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        pending: 0,
        other: 0,
        suites: 0,
        start: 0,
        stop: 0,
      },
      tests: [],
    },
  };

  for (const suite of inputReport.suites) {
    for (const spec of suite.specs) {
      for (const test of spec.tests) {
        const testResult = {
          name: spec.title,
          status: test.status === "unexpected" ? "failed" : test.status,
          duration: test.results[0].duration,
          start: test.results[0].startTime,
          suite: `[${test.projectName || test.projectId}] ${suite.title}`,
          message: stripVTControlCharacters(
            test.results?.[0]?.error?.message ?? ""
          ),
          trace: test.results?.[0]?.errors
            ?.map((err) => stripVTControlCharacters(err.message))
            ?.join("\n\n"),
          line: spec.line,
          rawStatus: test.status,
          tags: spec.tags,
          type: "playwright",
          filePath: test.results?.[0].errors?.find((err) => err.location)
            ?.location?.file,
          retries: test.results?.length === 1 ? 0 : test.results.length,
          attachments: test.results?.reduce((acc, result) => {
            if (result?.attachments) {
              acc.push(...result.attachments);
            }

            return acc;
          }, []),
        };

        switch (testResult.status) {
          case "passed": {
            report.results.summary.passed++;
            break;
          }
          case "skipped": {
            report.results.summary.skipped++;
            break;
          }
          case "failed": {
            report.results.summary.failed++;
            break;
          }
          default:
            report.results.summary.other++;
        }

        report.results.tests.push(testResult);
      }
    }
  }

  report.results.summary.tests = report.results.tests.length;

  return report;
};

function main() {
  const args = process.argv.slice(2);

  const inputFile = args[0];
  const outputFile = args[1];

  try {
    if (!fs.existsSync(inputFile)) {
      console.error(`❌ Error: Input file '${inputFile}' not found`);
      process.exit(1);
    }

    const ctrfReport = convertJsonToCtrf(
      JSON.parse(fs.readFileSync(inputFile, "utf8"))
    );

    fs.writeFileSync(outputFile, JSON.stringify(ctrfReport, null, 2));

    console.log(`✅ Successfully converted ${inputFile} to ${outputFile}`);
  } catch (error) {
    console.error("❌ Conversion failed:", error.message);
    process.exit(1);
  }
}

main();
