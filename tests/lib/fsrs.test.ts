import { describe, expect, it } from "vitest";
import {
  applyRating,
  createNewCard,
  hydrateCard,
  isDue,
  nextWordStatus,
} from "../../src/lib/fsrs";

describe("fsrs wrapper", () => {
  it("creates a serializable card and applies ratings with the official scheduler", () => {
    const now = new Date("2026-08-21T00:00:00.000Z");
    const card = createNewCard(now);

    expect(isDue(card, now)).toBe(true);

    const reviewed = applyRating(card, "good", now);

    expect(reviewed.reps).toBe(1);
    expect(new Date(reviewed.due).getTime()).toBeGreaterThan(now.getTime());
    expect(hydrateCard(reviewed).due).toBeInstanceOf(Date);
  });

  it("derives word status from the FSRS card state", () => {
    const now = new Date("2026-08-21T00:00:00.000Z");

    // 首次学习：state=Learning → 学习中
    const learning = applyRating(createNewCard(now), "good", now);
    expect(nextWordStatus(learning)).toBe("learning");

    // 连续多次答对：state=Review，稳定性增长 → 复习中 → 已掌握
    let card = createNewCard(now);
    for (let index = 0; index < 10; index += 1) {
      card = applyRating(
        card,
        "good",
        new Date(now.getTime() + index * 24 * 60 * 60 * 1000),
      );
    }
    expect(card.state).toBe(2);
    expect(nextWordStatus(card)).toBe("mastered");

    // 复习中答错：state=Relearning → 回到学习中
    const relearning = applyRating(
      card,
      "again",
      new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000),
    );
    expect(relearning.state).toBe(3);
    expect(nextWordStatus(relearning)).toBe("learning");
  });
});
