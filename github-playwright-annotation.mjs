import { XMLParser, XMLValidator } from "fast-xml-parser";
import fs from "node:fs/promises";
import * as core from "@actions/core";
import github from "@actions/github";
import Handlebars from "handlebars";

const xmlFileInput = "test-results/results.xml";
const summaryTemplateFile = "templates/summary.hbs";

async function main() {
  try {
    const xmlFile = await fs.readFile(xmlFileInput, "utf-8");

    const result = XMLValidator.validate(xmlFile);

    if (result?.err) {
      console.error(`XML is not valid: ${result.err.msg}`);
      return;
    }

    const xmlParser = new XMLParser({
      ignoreAttributes: false,
      allowBooleanAttributes: true,
      isArray: (tagName) => {
        switch (tagName) {
          case "testsuite":
          case "testcase":
            return true;
          default:
            return false;
        }
      },
    });
    const { testsuites } = xmlParser.parse(xmlFile);

    const testsuite = testsuites.testsuite;
    const failedTests = testsuite.flatMap((ts) =>
      ts.testcase
        .filter((tc) => tc.failure)
        .reduce(
          (acc, ft) => [
            ...acc,
            {
              name: `[${ts["@_hostname"]}] › ${ft["@_classname"]} › ${ft["@_name"]}`,
              message: ft.failure["@_message"],
              trace: ft.failure["#text"],
            },
          ],
          []
        )
    );

    const total = Number(testsuites["@_tests"]);
    const failed = Number(testsuites["@_failures"]);
    const skipped = Number(testsuites["@_skipped"]);
    const passed = total - failed - skipped;

    const summaryReport = await getSummaryReport({
      total,
      passed,
      failed,
      flaky: 0,
      skipped,
      duration: Number(testsuites["@_time"]),
      failedTests,
    });

    core.summary.addRaw(summaryReport, true);
    core.summary.write();
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

await main();

async function getSummaryReport({
  total,
  passed,
  failed,
  skipped,
  flaky,
  duration,
  failedTests = [],
}) {
  const rawTemplateContent = await fs.readFile(summaryTemplateFile, "utf-8");
  const template = Handlebars.compile(rawTemplateContent);

  return template({
    report: {
      total,
      passed,
      failed,
      skipped,
      flaky,
      duration,
      failedTests,
    },
    github: github.context,
  });
}