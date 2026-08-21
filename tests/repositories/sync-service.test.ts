import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import {
  createLocalDb,
  type SyncOperation,
} from "../../src/repositories/localDb";
import type { ReviewLog, StudySession, UserWord } from "../../src/types/domain";
import {
  enqueueSyncOperation,
  flushSyncQueue,
  listPendingSyncOperations,
  mergeReviewLogs,
  mergeUserWord,
  removeSyncOperation,
  syncLocalToCloud,
} from "../../src/repositories/syncService";

describe("sync merge rules", () => {
  it("chooses the newer word record by updatedAt", () => {
    const local = {
      id: "word-1",
      userId: "user-1",
      normalizedTerm: "address",
      updatedAt: 10,
    };
    const remote = { ...local, updatedAt: 20, notes: "cloud note" };

    expect(mergeUserWord(local, remote)).toEqual(remote);
    expect(mergeUserWord(remote, local)).toEqual(remote);
  });

  it("appends review logs and deduplicates by id", () => {
    const merged = mergeReviewLogs(
      [{ id: "log-1" }],
      [{ id: "log-1" }, { id: "log-2" }],
    );
    expect(merged).toHaveLength(2);
  });
});

describe("sync queue", () => {
  it("flushes operations in creation order and removes only successful ones", async () => {
    const db = createLocalDb(`test-sync-${crypto.randomUUID()}`);
    const userId = "user-1";

    const first = await enqueueSyncOperation(db, {
      userId,
      kind: "upsert-word",
      payload: { term: "first" },
    });
    const second = await enqueueSyncOperation(db, {
      userId,
      kind: "upsert-word",
      payload: { term: "second" },
    });

    expect(await listPendingSyncOperations(db, userId)).toHaveLength(2);

    const remote = {
      upsertWord: vi.fn().mockResolvedValue(undefined),
      appendReviewLog: vi.fn().mockResolvedValue(undefined),
      upsertSession: vi.fn().mockRejectedValue(new Error("network down")),
    };

    const firstResult = await flushSyncQueue(db, userId, remote as never);
    expect(firstResult.succeeded).toBe(2);
    expect(firstResult.failed).toBe(0);
    expect(remote.upsertWord).toHaveBeenCalledTimes(2);
    expect(remote.upsertWord.mock.calls[0][0]).toEqual({ term: "first" });
    expect(remote.upsertWord.mock.calls[1][0]).toEqual({ term: "second" });
    expect(await listPendingSyncOperations(db, userId)).toHaveLength(0);

    // 队列为空时不再调用远端
    await flushSyncQueue(db, userId, remote as never);
    expect(remote.upsertWord).toHaveBeenCalledTimes(2);

    // 失败的操作保留并记录错误
    await enqueueSyncOperation(db, {
      userId,
      kind: "upsert-session",
      payload: { id: "session-1" },
    });
    const secondResult = await flushSyncQueue(db, userId, remote as never);
    expect(secondResult.succeeded).toBe(0);
    expect(secondResult.failed).toBe(1);
    const pending: SyncOperation[] = await listPendingSyncOperations(
      db,
      userId,
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].lastError).toContain("network down");

    await removeSyncOperation(db, pending[0].id);
    expect(await listPendingSyncOperations(db, userId)).toHaveLength(0);

    db.close();
  });
});

describe("sync local to cloud", () => {
  it("uploads local data under the cloud user and merges cloud data back", async () => {
    const db = createLocalDb(`test-sync-cloud-${crypto.randomUUID()}`);

    const word: UserWord = {
      id: "word-1",
      userId: "local",
      term: "address",
      normalizedTerm: "address",
      meanings: [{ text: "处理，应对", source: "curated" }],
      status: "learning",
      tags: [],
      nextReviewAt: 100,
      createdAt: 1,
      updatedAt: 1,
    };
    const log: ReviewLog = {
      id: "log-1",
      userId: "local",
      wordId: "word-1",
      normalizedTerm: "address",
      rating: 3,
      answeredCorrectly: true,
      reviewedAt: 100,
      elapsedMs: 5000,
    };
    const session: StudySession = {
      id: "session-1",
      userId: "local",
      mode: "new",
      wordIds: ["word-1"],
      currentIndex: 1,
      startedAt: 100,
      completedAt: 200,
    };
    await db.userWords.put(word);
    await db.reviewLogs.put(log);
    await db.studySessions.put(session);

    // 云端已有的同词条（updatedAt 更新），应合并回来
    const cloudWord: UserWord = {
      ...word,
      userId: "user-1",
      updatedAt: 2,
      status: "mastered",
    };
    const uploaded: unknown[] = [];
    const remote = {
      upsertWord: vi.fn().mockImplementation(async (item: UserWord) => {
        uploaded.push(item);
      }),
      appendReviewLog: vi.fn().mockResolvedValue(undefined),
      upsertSession: vi.fn().mockResolvedValue(undefined),
      listUserWords: vi.fn().mockResolvedValue([cloudWord]),
      listReviewLogs: vi.fn().mockResolvedValue([]),
      listStudySessions: vi.fn().mockResolvedValue([]),
    };

    const result = await syncLocalToCloud(db, remote as never, "user-1");

    expect(result.uploaded).toBe(3);
    // 上传时 userId 映射为云端账号
    expect((uploaded[0] as UserWord).userId).toBe("user-1");
    // 云端更新的词条合并回本地（保持 local 身份）
    const merged = await db.userWords.get(["local", "address"]);
    expect(merged?.status).toBe("mastered");
    expect(merged?.userId).toBe("local");

    db.close();
  });

  it("only uploads data changed since the last sync", async () => {
    const db = createLocalDb(`test-sync-delta-${crypto.randomUUID()}`);

    const oldWord: UserWord = {
      id: "word-old",
      userId: "local",
      term: "old",
      normalizedTerm: "old",
      meanings: [{ text: "旧的", source: "curated" }],
      status: "new",
      tags: [],
      nextReviewAt: null,
      createdAt: 1,
      updatedAt: 100,
    };
    const newWord: UserWord = {
      ...oldWord,
      id: "word-new",
      term: "new",
      normalizedTerm: "new",
      updatedAt: 200,
    };
    await db.userWords.bulkPut([oldWord, newWord]);

    const uploaded: string[] = [];
    const remote = {
      upsertWord: vi.fn().mockImplementation(async (item: UserWord) => {
        uploaded.push(item.normalizedTerm);
      }),
      appendReviewLog: vi.fn().mockResolvedValue(undefined),
      upsertSession: vi.fn().mockResolvedValue(undefined),
      listUserWords: vi.fn().mockResolvedValue([]),
      listReviewLogs: vi.fn().mockResolvedValue([]),
      listStudySessions: vi.fn().mockResolvedValue([]),
    };

    // 上次同步时间 150：只应上传 updatedAt > 150 的 new
    const result = await syncLocalToCloud(db, remote as never, "user-1", 150);

    expect(result.uploaded).toBe(1);
    expect(uploaded).toEqual(["new"]);

    db.close();
  });
});
