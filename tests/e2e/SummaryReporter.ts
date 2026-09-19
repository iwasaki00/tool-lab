import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

export default class SummaryReporter implements Reporter {
  private rows: Array<{ name: string; passed: boolean }> = [];
  onTestEnd(test: TestCase, result: TestResult): void { this.rows.push({ name: test.title, passed: result.status === "passed" }); }
  onEnd(result: FullResult): void {
    if (!this.rows.length) return;
    const passed = this.rows.filter((row) => row.passed).length;
    console.log("\n3D SPACE LAB E2E\n"); this.rows.forEach((row) => console.log(`${row.name.padEnd(12)} ${row.passed ? "PASS" : "FAIL"}`));
    console.log(`\nTOTAL\n${passed} PASS\n${this.rows.length - passed} FAIL\nSTATUS ${result.status.toUpperCase()}\n`);
  }
}
