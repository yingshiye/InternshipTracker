import assert from "node:assert/strict";
import test from "node:test";
import { PREP_ROADMAP, PREP_TASK_COUNT, PREP_TOTAL_MINUTES } from "./roadmap";

test("prep roadmap has three complete seven-day weeks", () => {
  assert.equal(PREP_ROADMAP.length, 21);
  assert.deepEqual(
    PREP_ROADMAP.map((day) => day.day),
    Array.from({ length: 21 }, (_, index) => index + 1),
  );
  assert.deepEqual(
    [1, 2, 3].map((week) => PREP_ROADMAP.filter((day) => day.week === week).length),
    [7, 7, 7],
  );
});

test("every study day stays within the four-to-five-hour budget", () => {
  for (const day of PREP_ROADMAP) {
    const minutes = day.tasks.reduce((sum, task) => sum + task.minutes, 0);
    assert.ok(minutes >= 240, `Day ${day.day} is only ${minutes} minutes`);
    assert.ok(minutes <= 300, `Day ${day.day} is ${minutes} minutes`);
  }
});

test("task ids are stable and unique", () => {
  const tasks = PREP_ROADMAP.flatMap((day) => day.tasks);
  const ids = new Set(tasks.map((task) => task.id));
  assert.equal(ids.size, tasks.length);
  assert.equal(PREP_TASK_COUNT, tasks.length);
  assert.equal(PREP_TOTAL_MINUTES, tasks.reduce((sum, task) => sum + task.minutes, 0));
});

test("all resource links use HTTPS", () => {
  for (const task of PREP_ROADMAP.flatMap((day) => day.tasks)) {
    if (task.resourceUrl) assert.match(task.resourceUrl, /^https:\/\//);
    for (const problem of task.problems ?? []) assert.match(problem.url, /^https:\/\//);
  }
});
