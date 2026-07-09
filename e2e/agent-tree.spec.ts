import { test, expect } from "@playwright/test";
import path from "node:path";

// Self-sufficient: navigate straight to the project view by absolute path so
// this file doesn't depend on the deck being populated by another spec.
const rocket = path.resolve("e2e/fixtures/workspace/rocket-shop");
const moon = path.resolve("e2e/fixtures/workspace/moon-blog");
const projectUrl = (p: string) => `/project?path=${encodeURIComponent(p)}`;

test("session shows the agent tree with task agents + a workflow run", async ({ page }) => {
  await page.goto(projectUrl(rocket));

  const tree = page.getByTestId("agent-tree");
  await expect(tree).toBeVisible();
  await expect(tree).toContainText("agents (4)"); // 2 task + 2 workflow

  await expect(tree).toContainText("builder");
  await expect(tree).toContainText("Build the checkout form");
  await expect(tree).toContainText("reviewer");
  await expect(tree).toContainText("Review the checkout form");

  const wf = page.getByTestId("workflow-run");
  await expect(wf).toContainText("wf_check01");
  await expect(wf).toContainText("2 agents");
  await expect(wf.getByTestId("agent-row")).toHaveCount(2);

  await expect(tree.getByTestId("agent-row").first()).toContainText("messages");
});

test("expanding a subagent loads its transcript inline", async ({ page }) => {
  await page.goto(projectUrl(rocket));

  const builderRow = page
    .getByTestId("agent-tree")
    .getByTestId("agent-row")
    .filter({ hasText: "Build the checkout form" });
  await builderRow.getByTestId("agent-toggle").click();

  const thread = builderRow.getByTestId("agent-thread");
  await expect(thread).toBeVisible();
  await expect(thread).toContainText("Build the checkout form with the payment fields"); // the task prompt
  await expect(thread).toContainText("Built the form and wired validation.");
  await expect(thread).toContainText("Edit"); // tool chip

  await builderRow.getByTestId("agent-toggle").click();
  await expect(builderRow.getByTestId("agent-thread")).toHaveCount(0);
});

test("a session without subagents shows no agent tree", async ({ page }) => {
  await page.goto(projectUrl(moon));
  await expect(page.getByTestId("thread")).toBeVisible();
  await expect(page.getByTestId("agent-tree")).toHaveCount(0);
});
