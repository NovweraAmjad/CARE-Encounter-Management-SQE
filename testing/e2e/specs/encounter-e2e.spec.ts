import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  browserLogin,
  cleanupEncounter,
  createActiveEncounterDirect,
  getEncounter,
  getFixture,
  resetActiveEncounters,
  updateEncounter,
} from "../helpers";

/** Press Tab until `locator` has focus (keyboard only). */
async function tabTo(page: Page, locator: Locator, maxTabs = 60) {
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press("Tab");
    if (
      await locator.evaluate(
        (element: Element) => element === document.activeElement,
      )
    ) {
      return;
    }
  }
  await expect(locator).toBeFocused();
}

/** Short description of the focused element, for the focus-order evidence. */
async function describeFocus(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "none";
    const name = (
      el.getAttribute("aria-label") ||
      (el as HTMLInputElement).labels?.[0]?.innerText ||
      el.innerText ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    const type = (el as HTMLInputElement).type ? `[${(el as HTMLInputElement).type}]` : "";
    const inDialog = el.closest("[role=dialog]") ? "" : " (outside dialog)";
    return `${el.tagName.toLowerCase()}${type} "${name}"${inDialog}`;
  });
}

test("create a patient encounter with keyboard validation correction", async ({
  page,
}, testInfo) => {
  // ---- Setup: synthetic patient at the active-encounter limit (BR-ENC-01) ----
  const fixture = await getFixture();
  await resetActiveEncounters(fixture);
  const activeSetups = [];
  const directSetupStatuses = [];
  for (let index = 0; index < 10; index += 1) {
    const setup = await createActiveEncounterDirect(fixture);
    directSetupStatuses.push(setup.status);
    if ([200, 201].includes(setup.status)) {
      activeSetups.push(setup);
    } else if (setup.status === 400) {
      break;
    }
  }
  expect(activeSetups.length).toBeGreaterThan(0);
  expect(directSetupStatuses).toContain(400);

  const createRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/api\/v1\/encounter\/?$/.test(new URL(request.url()).pathname)) {
      createRequests.push(request.url());
    }
  });

  // ---- Open the task screen ----
  await browserLogin(page);
  await page.goto(
    `/facility/${fixture.facilityId}/patient/${fixture.patientId}`,
    { waitUntil: "commit" },
  );
  const patientHomeLink = page
    .getByRole("link", { name: "Patient Home" })
    .first();
  await expect(patientHomeLink).toBeVisible();
  await patientHomeLink.click();

  const createEncounterButton = page.getByRole("button", {
    name: "Create Encounter",
  });
  await expect(createEncounterButton).toBeVisible();
  await createEncounterButton.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const dateButton = dialog.getByRole("button", {
    name: /^[A-Z][a-z]+ \d{1,2}(st|nd|rd|th), \d{4}$/,
  });
  const timeInput = dialog.locator('input[type="time"]');
  const ambulatory = dialog.getByRole("button", { name: /^Ambulatory/ });
  const status = dialog.getByRole("combobox", { name: "Status" });
  const priority = dialog.getByRole("combobox", { name: "Priority" });
  const department = dialog.getByRole("button", { name: /select department/i });
  const submit = dialog.getByRole("button", { name: /^Create Encounter/ });
  // Submit is disabled until the default department has loaded.
  await expect(submit).toBeEnabled();
  const todayText = (await dateButton.innerText()).trim();

  // ---- Keyboard: focus reaches required fields, then submit, in order ----
  const required = [
    { name: "Date", locator: dateButton },
    { name: "Time", locator: timeInput },
    { name: "Type of Encounter (Ambulatory)", locator: ambulatory },
    { name: "Status", locator: status },
    { name: "Priority", locator: priority },
    { name: "Departments", locator: department },
    { name: "Create Encounter (submit)", locator: submit },
  ];
  const handles = await Promise.all(required.map((r) => r.locator.elementHandle()));
  const focusLog: { tab: number; focused: string; requiredField: string | null }[] = [];
  for (let tab = 1; tab <= 60; tab += 1) {
    await page.keyboard.press("Tab");
    const index = await page.evaluate(
      (elements) => elements.findIndex((el) => el === document.activeElement),
      handles,
    );
    focusLog.push({
      tab,
      focused: await describeFocus(page),
      requiredField: index >= 0 ? required[index].name : null,
    });
  }
  // Use one full cycle that starts at the first field (Date).
  const start = focusLog.findIndex((entry) => entry.requiredField === "Date");
  expect(start).toBeGreaterThanOrEqual(0);
  const cycle = focusLog.slice(start);
  const firstSeen = required.map((r) =>
    cycle.findIndex((entry) => entry.requiredField === r.name),
  );
  for (const [i, position] of firstSeen.entries()) {
    expect(position, `${required[i].name} receives keyboard focus`).toBeGreaterThanOrEqual(0);
    if (i > 0) {
      expect(position, `${required[i].name} comes after ${required[i - 1].name}`).toBeGreaterThan(firstSeen[i - 1]);
    }
  }
  await testInfo.attach("keyboard-focus-order.json", {
    body: JSON.stringify({ expectedOrder: required.map((r) => r.name), firstSeenInCycle: firstSeen, focusLog }, null, 2),
    contentType: "application/json",
  });

  // ---- Enter a value the business rule rejects (BR-ENC-02), keyboard only ----
  // Start date = tomorrow, chosen in the calendar with the keyboard.
  await tabTo(page, dateButton);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("grid")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => !!document.activeElement?.closest("[role=grid]")))
    .toBe(true);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("grid")).toBeHidden();
  // innerText = visible text only (the button also holds a hidden short date).
  await expect.poll(async () => (await dateButton.innerText()).trim()).not.toBe(todayText);

  await tabTo(page, ambulatory);
  await page.keyboard.press("Enter");

  // Status = In Progress (a future start is only allowed for Planned).
  await tabTo(page, status);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option", { name: "In Progress" })).toBeVisible();
  for (let i = 0; i < 4; i += 1) {
    const focusedText = await page.evaluate(() => (document.activeElement as HTMLElement)?.innerText?.trim());
    if (focusedText === "In Progress") break;
    await page.keyboard.press("ArrowUp");
  }
  await page.keyboard.press("Enter");
  await expect(status).toHaveText(/In Progress/);

  const requestsBeforeRejectedSubmit = createRequests.length;
  await tabTo(page, submit);
  await expect(submit).toBeFocused();
  await page.keyboard.press("Enter");

  // The error explains what to correct and nothing is sent to the server.
  const futureDateError = dialog.getByText(
    "Future date is only allowed for planned encounters",
  );
  await expect(futureDateError).toBeVisible();
  expect(createRequests).toHaveLength(requestsBeforeRejectedSubmit);
  // The message is shown directly under the Date and Time field.
  const dateBox = await dateButton.boundingBox();
  const errorBox = await futureDateError.boundingBox();
  expect(errorBox!.y).toBeGreaterThan(dateBox!.y);
  expect(errorBox!.y - (dateBox!.y + dateBox!.height)).toBeLessThan(60);
  await page.screenshot({ path: testInfo.outputPath("rejected-future-date.png") });
  await testInfo.attach("rejected-future-date", {
    path: testInfo.outputPath("rejected-future-date.png"),
    contentType: "image/png",
  });

  // ---- Correct the value with the keyboard: start date back to today ----
  await tabTo(page, dateButton);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("grid")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (document.activeElement as HTMLElement)?.getAttribute("aria-label") ?? ""))
    .toMatch(/^Today/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("grid")).toBeHidden();
  await expect.poll(async () => (await dateButton.innerText()).trim()).toBe(todayText);
  await expect(futureDateError).toBeHidden();

  // ---- Server-side rule (BR-ENC-01): active-encounter limit ----
  await tabTo(page, submit);
  await expect(submit).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(/maximum number of active encounters/i),
  ).toBeVisible();

  for (const setup of activeSetups) {
    await cleanupEncounter(fixture, setup.data.id);
  }
  await cleanupEncounter(fixture, fixture.encounterId);

  // ---- Keyboard submit succeeds and the confirmation is shown ----
  await tabTo(page, submit);
  await expect(submit).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Encounter created successfully")).toBeVisible();
  await expect(page).toHaveURL(/\/encounter\/[^/]+\/updates/);

  const encounterId = page.url().match(/\/encounter\/([^/]+)\//)?.[1];
  expect(encounterId).toBeTruthy();
  const created = await getEncounter(fixture, encounterId!);
  expect(created.status).toBe("in_progress");
  expect(created.encounter_class).toBe("amb");
});

test("complete an existing encounter", async ({ page }) => {
  const fixture = await getFixture();
  await resetActiveEncounters(fixture);
  const existingUpdate = await updateEncounter(
    fixture,
    fixture.encounterId,
    { status: "in_progress" },
  );
  expect([200, 202]).toContain(existingUpdate.status);

  // ---- Open the task screen ----
  await browserLogin(page);
  await page.goto(
    `/facility/${fixture.facilityId}/patient/${fixture.patientId}/encounter/${fixture.encounterId}/updates`,
    { waitUntil: "commit" },
  );
  await expect(page.getByRole("region", { name: "Encounter", exact: true }))
    .toBeVisible();

  // ---- Use the visible control: summary panel > Actions > Mark as Completed ----
  // (EncounterShow.tsx also renders an sr-only, tabIndex=-1 copy of this button
  // as a keyboard-shortcut target; the user-facing one is in the Actions panel.)
  await page.getByRole("tab", { name: "Actions", exact: true }).click();
  const actionsPanel = page.getByRole("tabpanel", { name: "Actions" });
  await expect(actionsPanel).toBeVisible();
  const markComplete = actionsPanel.getByRole("button", { name: /Mark as Completed/i });
  await expect(markComplete).toBeVisible();
  await markComplete.click();

  const confirmDialog = page.getByRole("alertdialog");
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Mark as complete" }).click();

  // ---- Confirmation shown to the user, and the record is completed ----
  await expect(page.getByText("Encounter Completed", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Status History: Completed/i }),
  ).toBeVisible();
  const record = await getEncounter(fixture, fixture.encounterId);
  expect(record.status).toBe("completed");
  await cleanupEncounter(fixture, fixture.encounterId);
});
