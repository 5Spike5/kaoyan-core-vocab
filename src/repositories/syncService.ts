import type { LocalVocabDatabase, SyncOperation } from "./localDb";
import type { ReviewLog, StudySession, UserWord } from "../types/domain";

const LOCAL_USER_ID = "local";

export type SyncRemote = {
  upsertWord(word: UserWord): Promise<void>;
  appendReviewLog(log: ReviewLog): Promise<void>;
  upsertSession(session: StudySession): Promise<void>;
};

export type CloudSyncRemote = SyncRemote & {
  listUserWords(userId: string): Promise<UserWord[]>;
  listReviewLogs(userId: string): Promise<ReviewLog[]>;
  listStudySessions(userId: string): Promise<StudySession[]>;
};

export type SyncFlushResult = {
  succeeded: number;
  failed: number;
};

export function mergeUserWord<T extends { updatedAt: number }>(
  local: T,
  remote: T,
): T {
  return local.updatedAt >= remote.updatedAt ? local : remote;
}

export function mergeReviewLogs<T extends { id: string }>(
  local: T[],
  remote: T[],
): T[] {
  return [
    ...new Map([...remote, ...local].map((item) => [item.id, item])).values(),
  ];
}

export function mergeStudySessions<
  T extends { id: string; updatedAt?: number },
>(local: T[], remote: T[]): T[] {
  const merged = new Map<string, T>();
  for (const item of [...remote, ...local]) {
    const existing = merged.get(item.id);
    if (!existing || (item.updatedAt ?? 0) >= (existing.updatedAt ?? 0)) {
      merged.set(item.id, item);
    }
  }
  return [...merged.values()];
}

function createOperationId() {
  return (
    globalThis.crypto?.randomUUID?.() ?? `sync-${Date.now()}-${Math.random()}`
  );
}

export async function enqueueSyncOperation(
  db: LocalVocabDatabase,
  input: { userId: string; kind: SyncOperation["kind"]; payload: unknown },
): Promise<SyncOperation> {
  const operation: SyncOperation = {
    id: createOperationId(),
    userId: input.userId,
    kind: input.kind,
    payload: input.payload,
    createdAt: Date.now(),
  };
  await db.syncOperations.put(operation);
  return operation;
}

export async function listPendingSyncOperations(
  db: LocalVocabDatabase,
  userId: string,
): Promise<SyncOperation[]> {
  return db.syncOperations.where("userId").equals(userId).sortBy("createdAt");
}

export async function removeSyncOperation(
  db: LocalVocabDatabase,
  operationId: string,
): Promise<void> {
  await db.syncOperations.delete(operationId);
}

export async function flushSyncQueue(
  db: LocalVocabDatabase,
  userId: string,
  remote: SyncRemote,
): Promise<SyncFlushResult> {
  const pending = await listPendingSyncOperations(db, userId);
  const result: SyncFlushResult = { succeeded: 0, failed: 0 };

  for (const operation of pending) {
    try {
      switch (operation.kind) {
        case "upsert-word":
          await remote.upsertWord(operation.payload as UserWord);
          break;
        case "append-review-log":
          await remote.appendReviewLog(operation.payload as ReviewLog);
          break;
        case "upsert-session":
          await remote.upsertSession(operation.payload as StudySession);
          break;
      }
      await removeSyncOperation(db, operation.id);
      result.succeeded += 1;
    } catch (error) {
      result.failed += 1;
      await db.syncOperations.update(operation.id, {
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/**
 * 本地优先同步：把本地（local 身份）的单词、复习日志、会话整体上传到
 * 云端账号（userId 映射为登录用户），再拉取云端数据合并回本地。
 * 本地是学习的工作集，云端是账号下的数据副本。
 */
export async function syncLocalToCloud(
  db: LocalVocabDatabase,
  remote: CloudSyncRemote,
  cloudUserId: string,
): Promise<{ uploaded: number; merged: number }> {
  const [localWords, localLogs, localSessions] = await Promise.all([
    db.userWords.where("userId").equals(LOCAL_USER_ID).toArray(),
    db.reviewLogs.where("userId").equals(LOCAL_USER_ID).toArray(),
    db.studySessions.where("userId").equals(LOCAL_USER_ID).toArray(),
  ]);

  // 1. 上传本地改动到云端账号
  for (const word of localWords) {
    await remote.upsertWord({ ...word, userId: cloudUserId });
  }
  for (const log of localLogs) {
    await remote.appendReviewLog({ ...log, userId: cloudUserId });
  }
  for (const session of localSessions) {
    await remote.upsertSession({ ...session, userId: cloudUserId });
  }

  // 2. 拉取云端数据并与本地合并（以 updatedAt / id 去重，写回时保持 local 身份）
  const [cloudWords, cloudLogs, cloudSessions] = await Promise.all([
    remote.listUserWords(cloudUserId),
    remote.listReviewLogs(cloudUserId),
    remote.listStudySessions(cloudUserId),
  ]);

  const mergedWords = new Map<string, UserWord>();
  for (const word of [...cloudWords, ...localWords]) {
    const existing = mergedWords.get(word.normalizedTerm);
    if (!existing || word.updatedAt >= existing.updatedAt) {
      mergedWords.set(word.normalizedTerm, { ...word, userId: LOCAL_USER_ID });
    }
  }
  for (const word of mergedWords.values()) {
    await db.userWords.put(word);
  }

  const mergedLogs = mergeReviewLogs(
    localLogs,
    cloudLogs.map((log) => ({ ...log, userId: LOCAL_USER_ID })),
  );
  for (const log of mergedLogs) {
    await db.reviewLogs.put(log);
  }

  const mergedSessions = mergeStudySessions(
    localSessions,
    cloudSessions.map((session) => ({ ...session, userId: LOCAL_USER_ID })),
  );
  for (const session of mergedSessions) {
    await db.studySessions.put(session);
  }

  // 3. 清理历史版本同步时可能写入的云端身份本地副本
  await db.userWords.where("userId").equals(cloudUserId).delete();
  await db.reviewLogs.where("userId").equals(cloudUserId).delete();
  await db.studySessions.where("userId").equals(cloudUserId).delete();

  return {
    uploaded: localWords.length + localLogs.length + localSessions.length,
    merged: mergedWords.size,
  };
}
