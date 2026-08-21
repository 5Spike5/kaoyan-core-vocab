import { Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "../../components/Toast";
import { publicVocab } from "../../data/publicVocab";
import {
  downloadVocabWorkbook,
  readVocabWorkbookFile,
  type VocabImportResult,
} from "../../lib/csv";
import { createLocalRepository } from "../../repositories/localRepository";
import type { UserWord, UserWordStatus } from "../../types/domain";
import {
  createUserWordFromLookup,
  mergePublicAndUserWords,
} from "./vocabService";

const LOCAL_USER_ID = "local";

const STATUS_FILTERS: Array<{ value: UserWordStatus | "all"; label: string }> =
  [
    { value: "all", label: "全部" },
    { value: "new", label: "新词" },
    { value: "learning", label: "学习中" },
    { value: "reviewing", label: "复习中" },
    { value: "mastered", label: "已掌握" },
    { value: "suspended", label: "暂停" },
  ];

const STATUS_LABELS: Record<UserWordStatus, string> = {
  new: "新词",
  learning: "学习中",
  reviewing: "复习中",
  mastered: "已掌握",
  suspended: "暂停",
};

type ImportModalState = {
  open: boolean;
  fileName: string | null;
  result: VocabImportResult | null;
  error: string | null;
  parsing: boolean;
  dragover: boolean;
};

export default function VocabListPage() {
  const [words, setWords] = useState<UserWord[]>([]);
  const [statusFilter, setStatusFilter] = useState<UserWordStatus | "all">(
    "all",
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modal, setModal] = useState<ImportModalState>({
    open: false,
    fileName: null,
    result: null,
    error: null,
    parsing: false,
    dragover: false,
  });

  const loadWords = useCallback(async () => {
    const repository = createLocalRepository();
    try {
      const userWords = await repository.listUserWords(LOCAL_USER_ID);
      setWords(mergePublicAndUserWords(publicVocab, userWords));
    } finally {
      await repository.close();
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWords();
  }, [loadWords]);

  const filteredWords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return words.filter((word) => {
      const matchesStatus =
        statusFilter === "all" || word.status === statusFilter;
      if (!matchesStatus) {
        return false;
      }
      if (!query) {
        return true;
      }
      const meaningText = word.meanings.map((item) => item.text).join(" ");
      return (
        word.term.toLowerCase().includes(query) ||
        meaningText.toLowerCase().includes(query)
      );
    });
  }, [words, statusFilter, search]);

  const handleExport = useCallback(() => {
    downloadVocabWorkbook(filteredWords);
    toast(`已导出 ${filteredWords.length} 个单词`, "success");
  }, [filteredWords]);

  const handleParseFile = useCallback(async (file: File) => {
    setModal((previous) => ({
      ...previous,
      parsing: true,
      error: null,
      result: null,
      fileName: file.name,
    }));
    try {
      const result = await readVocabWorkbookFile(file);
      setModal((previous) => ({
        ...previous,
        parsing: false,
        result,
        error: result.imported.length === 0 ? "没有可导入的词条" : null,
      }));
    } catch (error) {
      setModal((previous) => ({
        ...previous,
        parsing: false,
        result: null,
        error: `导入失败：${error instanceof Error ? error.message : "无法解析文件"}`,
      }));
    }
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (!modal.result || modal.result.imported.length === 0) {
      return;
    }

    const repository = createLocalRepository();
    try {
      for (const row of modal.result.imported) {
        await repository.upsertUserWord(
          createUserWordFromLookup({ term: row.term, meaning: row.meaning }),
        );
      }
      await loadWords();
      const { imported, skipped, duplicates, failed } = modal.result;
      const detail = [
        `新增 ${imported.length}`,
        skipped ? `跳过 ${skipped}` : "",
        duplicates ? `重复 ${duplicates}` : "",
        failed ? `失败 ${failed}` : "",
      ]
        .filter(Boolean)
        .join("，");
      toast(`导入成功：${detail}`, "success");
      setModal((previous) => ({
        ...previous,
        open: false,
        result: null,
        fileName: null,
      }));
    } finally {
      await repository.close();
    }
  }, [modal.result, loadWords]);

  const previewRows = modal.result?.imported.slice(0, 8) ?? [];
  const previewMore = (modal.result?.imported.length ?? 0) - previewRows.length;

  return (
    <section className="page vocab-page" aria-labelledby="vocab-title">
      <div className="page-heading">
        <p className="eyebrow">VOCABULARY</p>
        <h1 id="vocab-title">生词库</h1>
        <p className="lede">
          公开核心词库与个人生词合并展示，支持搜索、筛选、Excel 导入和导出。
        </p>
      </div>

      <div className="vocab-toolbar">
        <input
          type="search"
          className="vocab-search"
          aria-label="搜索生词"
          placeholder="搜索单词或释义"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="filter-row" role="group" aria-label="状态筛选">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`filter-chip ${statusFilter === filter.value ? "filter-chip-active" : ""}`}
              aria-pressed={statusFilter === filter.value}
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="vocab-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={handleExport}
          >
            <Download size={16} aria-hidden="true" />
            导出 Excel
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() =>
              setModal((previous) => ({ ...previous, open: true }))
            }
          >
            <Upload size={16} aria-hidden="true" />
            导入
          </button>
        </div>
      </div>

      {!loading ? (
        <p className="vocab-count">
          {filteredWords.length.toLocaleString()} /{" "}
          {words.length.toLocaleString()} 词
          {statusFilter !== "all" ? ` · ${STATUS_LABELS[statusFilter]}` : ""}
        </p>
      ) : null}

      {loading ? (
        <p className="page-note">正在加载生词库…</p>
      ) : (
        <ul className="vocab-list" aria-label="生词列表">
          {filteredWords.map((word, index) => (
            <li key={`${word.normalizedTerm}-${index}`} className="vocab-row">
              <div className="vocab-row-main">
                <strong>{word.term}</strong>
                <span className="vocab-meaning">
                  {word.meanings.map((item) => item.text).join("；")}
                </span>
              </div>
              <span className={`status-badge status-${word.status}`}>
                {STATUS_LABELS[word.status]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!loading && filteredWords.length === 0 ? (
        <p className="page-note">没有符合条件的单词。</p>
      ) : null}

      {modal.open ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModal((previous) => ({ ...previous, open: false }));
            }
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-modal-title"
          >
            <div className="modal-header">
              <h2 className="modal-title" id="import-modal-title">
                导入词汇
              </h2>
              <button
                type="button"
                className="modal-close"
                aria-label="关闭"
                onClick={() =>
                  setModal((previous) => ({ ...previous, open: false }))
                }
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="modal-body">
              <div
                className={`drop-zone ${modal.dragover ? "dragover" : ""}`}
                role="button"
                tabIndex={0}
                aria-label="选择或拖入 Excel 文件"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setModal((previous) => ({ ...previous, dragover: true }));
                }}
                onDragLeave={() =>
                  setModal((previous) => ({ ...previous, dragover: false }))
                }
                onDrop={(event) => {
                  event.preventDefault();
                  setModal((previous) => ({ ...previous, dragover: false }));
                  const file = event.dataTransfer.files?.[0];
                  if (file) {
                    void handleParseFile(file);
                  }
                }}
              >
                <FileSpreadsheet size={30} aria-hidden="true" />
                <strong>
                  {modal.parsing ? "正在解析文件…" : "将 Excel 文件拖到这里"}
                </strong>
                <span>或点击选择文件 · 支持 .xlsx / .xls / .csv</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden-file-input"
                aria-label="选择 Excel 文件"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleParseFile(file);
                  }
                  event.target.value = "";
                }}
              />

              {modal.error ? (
                <p className="form-error" role="alert">
                  {modal.error}
                </p>
              ) : null}

              {modal.result && modal.result.imported.length > 0 ? (
                <>
                  <div className="import-preview" aria-label="文件预览">
                    {previewRows.map((row) => (
                      <div
                        key={`${row.term}-${row.meaning}`}
                        className="import-preview-row"
                      >
                        <strong>{row.term}</strong>
                        <span>{row.meaning}</span>
                      </div>
                    ))}
                    {previewMore > 0 ? (
                      <p className="page-note" style={{ margin: 0 }}>
                        另有 {previewMore} 条未显示
                      </p>
                    ) : null}
                  </div>

                  <div className="import-summary">
                    <span className="import-summary-new">
                      新增 <b>{modal.result.imported.length}</b>
                    </span>
                    <span className="import-summary-dup">
                      重复 <b>{modal.result.duplicates}</b>
                    </span>
                    <span className="import-summary-skip">
                      跳过 <b>{modal.result.skipped}</b>
                    </span>
                    <span className="import-summary-fail">
                      失败 <b>{modal.result.failed}</b>
                    </span>
                  </div>
                </>
              ) : null}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setModal((previous) => ({ ...previous, open: false }))
                }
              >
                取消
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={!modal.result || modal.result.imported.length === 0}
                onClick={() => void handleConfirmImport()}
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
