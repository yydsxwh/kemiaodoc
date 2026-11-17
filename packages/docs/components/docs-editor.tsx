"use client";

/**
 * 网页文档编辑器：标题、多级标题、加粗、项目符号/编号、插图、简单表格。
 * 编号样子由 listScheme 决定，改方案立刻换 CSS，不必改正文 JSON。
 */

import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DOCS_CONTENT_MAX_CHARS,
  DOCS_LOCAL_ID,
  DOCS_MAX_PER_USER,
  DOCS_TITLE_MAX_CHARS,
  type DocsDocumentPayload,
  type DocsJsonNode,
} from "@andyyyds/docs/lib/docs-content";
import { downloadBlob, downloadTextFile } from "@andyyyds/docs/lib/docs-download";
import {
  docsContentToPlainText,
  importMarkupDetailed,
  titleFromFileName,
} from "@andyyyds/docs/lib/docs-html";
import {
  DEFAULT_DOCS_PAGE_CHROME,
  normalizePageChrome,
  safeDownloadName,
  type DocsPageChrome,
} from "@andyyyds/docs/lib/docs-page";
import { wrapStandaloneHtml } from "@andyyyds/docs/lib/docs-standalone-html";
import {
  buildListSchemeCss,
  normalizeListScheme,
  type DocsListScheme,
} from "@andyyyds/docs/lib/docs-scheme";
import {
  addDocsTag,
  createDocsDocumentRequest,
  deleteDocsDocumentRequest,
  DocsSaveConflictError,
  exportDocsDocxRequest,
  importDocsFile,
  removeDocsTag,
  saveDocsDocumentRequest,
  uploadDocsImage,
} from "@andyyyds/docs/lib/docs-client";
import type { DocsLibrarySnapshot } from "@andyyyds/docs/lib/docs-library";
import { loadLocalDocument, saveLocalDocument } from "@andyyyds/docs/lib/docs-local";
import {
  activeOutlineAnchor,
  DOCS_OUTLINE_DEFAULT_MAX_LEVEL,
  extractOutline,
  isHeadingAnchorId,
} from "@andyyyds/docs/lib/docs-outline";
import { isDocsSaveHotkey } from "@andyyyds/docs/lib/docs-save";
import { DocsPagePanel } from "@andyyyds/docs/components/docs-page-panel";
import { DocsPrintPreview } from "@andyyyds/docs/components/docs-print-preview";
import { DocsSchemePanel } from "@andyyyds/docs/components/docs-scheme-panel";
import { DocsHeading, DocsImage, rememberDocsImagePreview } from "@andyyyds/docs/components/docs-editor-extensions";
import { DocsLibraryNav, documentBreadcrumb } from "@andyyyds/docs/components/docs-library-nav";
import { DocsOutlineNav } from "@andyyyds/docs/components/docs-outline-nav";
import { DocsLightbox, DocsReader } from "@andyyyds/docs/components/docs-reader";
import { DocsSharePanel } from "@andyyyds/docs/components/docs-share-panel";
import "./docs-editor.css";

const AUTOSAVE_MS = 1200;
const GUEST_IMAGE_MAX_BYTES = 1.5 * 1024 * 1024;

const TabListKeys = Extension.create({
  name: "docsTabList",
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.sinkListItem("listItem"),
      "Shift-Tab": () => this.editor.commands.liftListItem("listItem"),
    };
  },
});

type Props = {
  initial: DocsDocumentPayload;
  loggedIn: boolean;
  library?: DocsLibrarySnapshot | null;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function headingValue(editor: Editor | null): string {
  if (!editor) return "0";
  for (let level = 1; level <= 6; level += 1) {
    if (editor.isActive("heading", { level })) return String(level);
  }
  return "0";
}

function collectImageFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter((file) => file.type.startsWith("image/"));
}

function measureImage(file: File): Promise<{ width?: number; height?: number }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: image.naturalWidth || undefined,
        height: image.naturalHeight || undefined,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    image.src = url;
  });
}

export function DocsEditor({ initial, loggedIn, library: libraryInitial = null }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [scheme, setScheme] = useState(() => normalizeListScheme(initial.listScheme));
  const [pageChrome, setPageChrome] = useState(() =>
    normalizePageChrome(initial.pageChrome || DEFAULT_DOCS_PAGE_CHROME),
  );
  const [schemeOpen, setSchemeOpen] = useState(false);
  const [pageOpen, setPageOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [docId, setDocId] = useState(initial.id);
  const [library, setLibrary] = useState(libraryInitial);
  const [mode, setMode] = useState<"edit" | "read">("edit");
  const [navPane, setNavPane] = useState<"library" | "outline">("outline");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [maxLevel, setMaxLevel] = useState(DOCS_OUTLINE_DEFAULT_MAX_LEVEL);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [missingAnchor, setMissingAnchor] = useState("");
  const [readContent, setReadContent] = useState<DocsJsonNode>(initial.content);
  const [outlineTick, setOutlineTick] = useState(0);
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const [tagName, setTagName] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [conflict, setConflict] = useState(false);
  const [imageError, setImageError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const openFileRef = useRef<HTMLInputElement>(null);
  const pendingImage = useRef<File | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarScrolledAt = useRef(0);
  const titleRef = useRef(title);
  const schemeRef = useRef(scheme);
  const chromeRef = useRef(pageChrome);
  const saveStateRef = useRef(saveState);
  const saveChain = useRef(Promise.resolve());
  const baseUpdatedAt = useRef(initial.updatedAt);
  const conflictRef = useRef(false);
  const docIdRef = useRef(docId);
  const [, setToolbarTick] = useState(0);
  titleRef.current = title;
  schemeRef.current = scheme;
  chromeRef.current = pageChrome;
  saveStateRef.current = saveState;
  docIdRef.current = docId;
  conflictRef.current = conflict;

  const schemeCss = useMemo(() => buildListSchemeCss(scheme), [scheme]);

  const insertImageFile = useCallback(async (editor: Editor, file: File) => {
    if (!file.type.startsWith("image/")) return;
    const size = await measureImage(file);
    if (loggedIn) {
      const uploaded = await uploadDocsImage(file);
      rememberDocsImagePreview(uploaded.src, uploaded.previewUrl);
      editor.chain().focus().insertContent({
        type: "image",
        attrs: { src: uploaded.src, alt: file.name, ...size },
      }).run();
      return;
    }
    if (file.size > GUEST_IMAGE_MAX_BYTES) {
      throw new Error("未登录插图请小于 1.5MB，或登录后上传");
    }
    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("读图失败"));
      reader.readAsDataURL(file);
    });
    editor.chain().focus().insertContent({
      type: "image",
      attrs: { src, alt: file.name, ...size },
    }).run();
  }, [loggedIn]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
      }),
      DocsHeading,
      DocsImage,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: "写正文，或用工具栏加标题、列表、图片和表格",
      }),
      TabListKeys,
    ],
    content: initial.content,
    editorProps: {
      attributes: {
        class: "docs-prose",
      },
      handlePaste: (_view, event) => {
        const current = editorRef.current;
        const files = collectImageFiles(event.clipboardData);
        if (!files.length || !current) return false;
        event.preventDefault();
        void insertImageFile(current, files[0]).catch((err: unknown) => {
          setSaveError(err instanceof Error ? err.message : "插图失败");
        });
        return true;
      },
      handleDrop: (_view, event) => {
        const current = editorRef.current;
        const files = collectImageFiles(event.dataTransfer);
        if (!files.length || !current) return false;
        event.preventDefault();
        void insertImageFile(current, files[0]).catch((err: unknown) => {
          setSaveError(err instanceof Error ? err.message : "插图失败");
        });
        return true;
      },
    },
    onUpdate: () => {
      setOutlineTick((tick) => tick + 1);
      setSaveState("dirty");
    },
    onSelectionUpdate: () => {
      setToolbarTick((tick) => tick + 1);
    },
  });
  editorRef.current = editor;

  useEffect(() => {
    if (!editor) return;
    const source =
      initial.id === DOCS_LOCAL_ID ? loadLocalDocument() : initial;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(source.content);
    if (current !== incoming) {
      editor.commands.setContent(source.content, false);
    }
    setTitle(source.title);
    setScheme(normalizeListScheme(source.listScheme));
    setPageChrome(normalizePageChrome(source.pageChrome || DEFAULT_DOCS_PAGE_CHROME));
    setDocId(source.id);
    baseUpdatedAt.current = source.updatedAt;
    setConflict(false);
    setReadContent(source.content);
    setLibrary(libraryInitial);
    setSaveState("idle");
  }, [editor, initial, libraryInitial]);

  const forceRef = useRef(false);
  const pathname = usePathname();

  const persist = useCallback(() => {
    const run = async () => {
      if (!editor || conflictRef.current) return;
      const content = editor.getJSON() as DocsJsonNode;
      const titleAtStart = titleRef.current;
      const force = forceRef.current;
      forceRef.current = false;
      setSaveState("saving");
      setSaveError("");
      try {
        if (!loggedIn || docIdRef.current === DOCS_LOCAL_ID) {
          const saved = saveLocalDocument({
            title: titleAtStart,
            content,
            listScheme: schemeRef.current,
            pageChrome: chromeRef.current,
          });
          baseUpdatedAt.current = saved.updatedAt;
        } else {
          const saved = await saveDocsDocumentRequest(docIdRef.current, {
            title: titleAtStart,
            content,
            listScheme: schemeRef.current,
            pageChrome: chromeRef.current,
            baseUpdatedAt: baseUpdatedAt.current,
            force,
          });
          baseUpdatedAt.current = saved.updatedAt;
        }
        const changed =
          JSON.stringify(editor.getJSON()) !== JSON.stringify(content) || titleRef.current !== titleAtStart;
        setSaveState(changed ? "dirty" : "saved");
      } catch (error) {
        if (error instanceof DocsSaveConflictError) {
          setConflict(true);
          setSaveState("error");
          setSaveError(error.message);
          return;
        }
        setSaveState("error");
        setSaveError(error instanceof Error ? error.message : "保存失败");
      }
    };
    const next = saveChain.current.then(run, run);
    saveChain.current = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }, [editor, loggedIn]);

  const saveNow = useCallback((force = false) => {
    if (force) {
      conflictRef.current = false;
      setConflict(false);
      forceRef.current = true;
    }
    void persist();
  }, [persist]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(() => {
      void persist();
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [persist, saveState, title, scheme, pageChrome]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isDocsSaveHotkey(event)) return;
      event.preventDefault();
      event.stopPropagation();
      saveNow();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [saveNow]);

  const markDirtyScheme = (next: DocsListScheme) => {
    setScheme(normalizeListScheme(next));
    setSaveState("dirty");
  };

  const markDirtyChrome = (next: DocsPageChrome) => {
    setPageChrome(normalizePageChrome(next));
    setSaveState("dirty");
  };

  const currentContent = (): DocsJsonNode =>
    (editor?.getJSON() as DocsJsonNode) || { type: "doc", content: [{ type: "paragraph" }] };

  const applyImported = (nextTitle: string, nextContent: DocsJsonNode) => {
    if (!editor) return;
    editor.commands.setContent(nextContent, false);
    setTitle(nextTitle.slice(0, DOCS_TITLE_MAX_CHARS));
    setSaveState("dirty");
  };

  const onOpenFile = async (file: File | undefined) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    try {
      if (/\.(docx|wps)$/i.test(name)) {
        const imported = await importDocsFile(file);
        if (imported.warnings?.length) setNotice(imported.warnings.join(" "));
        applyImported(imported.title, imported.content);
        return;
      }
      if (/\.doc$/i.test(name)) {
        throw new Error("旧版 .doc 打不开，请另存为 .docx");
      }
      const text = await file.text();
      const kind = /\.html?$/i.test(name) ? "html" : /\.md$/i.test(name) ? "md" : "txt";
      const detailed = importMarkupDetailed(text, kind);
      if (detailed.warnings.length) setNotice(detailed.warnings.join(" "));
      applyImported(titleFromFileName(file.name), detailed.content);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "打开文件失败");
    }
  };

  const saveAsHtml = () => {
    const html = wrapStandaloneHtml({
      title: titleRef.current,
      content: currentContent(),
      listScheme: schemeRef.current,
      pageChrome: chromeRef.current,
      docId,
    });
    downloadTextFile(html, safeDownloadName(titleRef.current, "html"), "text/html");
    setSaveAsOpen(false);
  };

  const saveAsTxt = () => {
    downloadTextFile(
      docsContentToPlainText(currentContent()),
      safeDownloadName(titleRef.current, "txt"),
      "text/plain",
    );
    setSaveAsOpen(false);
  };

  const saveAsDocx = async () => {
    try {
      const blob = await exportDocsDocxRequest({
        title: titleRef.current,
        content: currentContent(),
        pageChrome: chromeRef.current,
      });
      downloadBlob(blob, safeDownloadName(titleRef.current, "docx"));
      setSaveAsOpen(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "另存为 Word 失败");
    }
  };

  const run = (fn: (current: Editor) => void) => {
    if (!editor) return;
    fn(editor);
    editor.chain().focus().run();
  };

  const onPickImage = async (file: File | undefined) => {
    if (!file || !editor) return;
    pendingImage.current = file;
    try {
      await insertImageFile(editor, file);
      pendingImage.current = null;
      setImageError("");
      setSaveState("dirty");
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "插图失败");
    }
  };

  const saveToCloud = async () => {
    if (!editor) return;
    setSaveState("saving");
    setSaveError("");
    try {
      const created = await createDocsDocumentRequest({
        title: titleRef.current,
        content: editor.getJSON() as DocsJsonNode,
        listScheme: schemeRef.current,
        pageChrome: chromeRef.current,
      });
      window.location.href = `/products/docs/${created.id}`;
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "保存到云端失败");
    }
  };

  const removeCloudDoc = async () => {
    if (docId === DOCS_LOCAL_ID) return;
    if (!window.confirm("删除后不能恢复，确定删这篇？")) return;
    try {
      await deleteDocsDocumentRequest(docId);
      window.location.href = "/products/docs";
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "删除失败");
    }
  };

  const outline = useMemo(() => {
    const content = mode === "read" ? readContent : ((editor?.getJSON() as DocsJsonNode) || readContent);
    return extractOutline(content, docId || DOCS_LOCAL_ID);
  }, [docId, editor, mode, outlineTick, readContent]);
  const crumbs = documentBreadcrumb(library, docId, title || "未命名文档");
  const docTags = library?.tags.filter((tag) => tag.documentIds.includes(docId)) || [];

  useEffect(() => {
    const stored = window.localStorage.getItem("yyds-docs-sidebar-open");
    if (stored === "0") setSidebarOpen(false);
    const level = Number(window.localStorage.getItem("yyds-docs-toc-max-level"));
    if (level >= 1 && level <= 6) setMaxLevel(level);
  }, []);

  const jumpTo = useCallback((anchorId: string, push: boolean) => {
    const column = columnRef.current;
    const known = outline.some((item) => item.anchorId === anchorId);
    const scope = column?.querySelector(mode === "read" ? ".docs-reader" : ".ProseMirror");
    const target = scope?.querySelector(`[data-anchor-id="${anchorId}"]`) as HTMLElement | null;
    if (!known || !target) {
      if (isHeadingAnchorId(anchorId)) setMissingAnchor(anchorId);
      return false;
    }
    setMissingAnchor("");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    if (push && window.location.hash !== `#${anchorId}`) {
      window.history.pushState(null, "", `${pathname}${window.location.search}#${anchorId}`);
    }
    setActiveAnchor(anchorId);
    setDrawerOpen(false);
    return true;
  }, [mode, outline, pathname]);

  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    let frame = 0;
    const update = () => {
      const scope = column.querySelector(mode === "read" ? ".docs-reader" : ".ProseMirror");
      const positions = outline.flatMap((item) => {
        const element = scope?.querySelector(`[data-anchor-id="${item.anchorId}"]`) as HTMLElement | null;
        if (!element) return [];
        const top = element.getBoundingClientRect().top - column.getBoundingClientRect().top;
        return [{ anchorId: item.anchorId, top }];
      });
      const scrollingColumn = column.scrollHeight > column.clientHeight + 24;
      const nearBottom = scrollingColumn
        ? column.scrollTop + column.clientHeight >= column.scrollHeight - 8
        : window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8;
      setActiveAnchor(activeOutlineAnchor(positions, 88, nearBottom));
    };
    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };
    const onSidebarScroll = () => {
      sidebarScrolledAt.current = Date.now();
    };
    column.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    sidebarRef.current?.addEventListener("scroll", onSidebarScroll, { passive: true });
    update();
    return () => {
      window.cancelAnimationFrame(frame);
      column.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
      sidebarRef.current?.removeEventListener("scroll", onSidebarScroll);
    };
  }, [drawerOpen, mode, outline, sidebarOpen]);

  useEffect(() => {
    const anchor = activeAnchor;
    if (!anchor || Date.now() - sidebarScrolledAt.current < 1600) return;
    const button = sidebarRef.current?.querySelector(`[data-outline="${anchor}"]`);
    if (button instanceof HTMLElement) button.scrollIntoView({ block: "nearest" });
  }, [activeAnchor]);

  const jumpRef = useRef(jumpTo);
  jumpRef.current = jumpTo;

  useEffect(() => {
    const raw = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    let tries = 0;
    let timer = 0;
    const run = () => {
      if (!raw) return;
      tries += 1;
      const found = jumpRef.current(raw, false);
      if (!found && tries < 3) timer = window.setTimeout(run, tries === 1 ? 150 : 600);
    };
    const timerStart = window.setTimeout(run, 50);
    const onPop = () => {
      const next = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (next) jumpRef.current(next, false);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.clearTimeout(timerStart);
      window.clearTimeout(timer);
      window.removeEventListener("popstate", onPop);
    };
  }, [docId]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  const inTable = Boolean(editor?.isActive("table"));
  const saveLabel =
    saveState === "saving"
      ? "保存中…"
      : saveState === "saved"
        ? loggedIn && docId !== DOCS_LOCAL_ID
          ? "已保存到云端"
          : "已写入浏览器"
        : saveState === "dirty"
          ? "有未保存改动"
          : saveState === "error"
            ? "保存失败"
            : "已就绪";

  return (
    <div className={`docs-shell ${sidebarOpen ? "" : "is-collapsed"}`}>
      <div className="docs-mobile-bar docs-no-print">
        <button type="button" className="btn btn-secondary min-h-11 px-3 text-sm" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>
          目录
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-3 text-sm"
          onClick={() => {
            const next = !sidebarOpen;
            setSidebarOpen(next);
            window.localStorage.setItem("yyds-docs-sidebar-open", next ? "1" : "0");
          }}
        >
          {sidebarOpen ? "收起侧栏" : "展开侧栏"}
        </button>
      </div>
      {missingAnchor ? (
        <p className="docs-missing" role="status">章节已调整或删除</p>
      ) : null}
      <aside
        ref={sidebarRef}
        className={`docs-sidebar docs-no-print ${drawerOpen ? "is-open" : ""}`}
        aria-label="文档导航"
      >
        <div className="docs-pane-switch">
          <button type="button" className={`btn min-h-11 flex-1 px-3 text-sm ${navPane === "library" ? "btn-primary" : "btn-secondary"}`} onClick={() => setNavPane("library")}>
            知识库
          </button>
          <button type="button" className={`btn min-h-11 flex-1 px-3 text-sm ${navPane === "outline" ? "btn-primary" : "btn-secondary"}`} onClick={() => setNavPane("outline")}>
            本篇目录
          </button>
        </div>
        {navPane === "library" ? (
          <DocsLibraryNav
            library={library}
            loggedIn={loggedIn}
            currentId={docId}
            activeTag={activeTag}
            onLibrary={setLibrary}
            onTag={setActiveTag}
            onError={setSaveError}
          />
        ) : (
          <DocsOutlineNav
            items={outline}
            activeId={activeAnchor}
            maxLevel={maxLevel}
            onMaxLevel={(level) => {
              setMaxLevel(level);
              window.localStorage.setItem("yyds-docs-toc-max-level", String(level));
            }}
            collapsed={collapsed}
            onToggle={(anchorId) =>
              setCollapsed((current) => {
                const next = new Set(current);
                if (next.has(anchorId)) next.delete(anchorId);
                else next.add(anchorId);
                return next;
              })
            }
            onJump={(anchorId) => jumpTo(anchorId, true)}
          />
        )}
        <button type="button" className="btn btn-secondary docs-drawer-close min-h-11 px-3 text-sm" onClick={() => setDrawerOpen(false)}>
          关闭目录
        </button>
      </aside>
      {drawerOpen ? (
        <button type="button" className="docs-drawer-mask" aria-label="关闭目录" onClick={() => setDrawerOpen(false)} />
      ) : null}
      <div className="docs-reading-column docs-anchor-root" ref={columnRef}>
        <nav className="docs-breadcrumb docs-no-print" aria-label="当前位置">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`}>
              {index ? <span aria-hidden="true"> / </span> : null}
              {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>}
            </span>
          ))}
          <span className="docs-updated">更新于 {new Date(baseUpdatedAt.current).toLocaleString("zh-CN")}</span>
        </nav>
    <div className="surface overflow-hidden rounded-[28px]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-3 sm:px-5">
        <Link href="/products/docs" className="btn btn-secondary min-h-11 px-3 text-sm">
          全部文档
        </Link>
        <span className="text-xs text-[var(--muted)]">{saveLabel}</span>
        <button
          type="button"
          className={`btn min-h-11 px-3 text-sm ${mode === "read" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => {
            if (mode === "edit") {
              setReadContent(currentContent());
              setMode("read");
            } else {
              setMode("edit");
            }
          }}
        >
          {mode === "read" ? "返回编辑" : "阅读"}
        </button>
        {loggedIn && docId !== DOCS_LOCAL_ID ? (
          <DocsSharePanel
            documentId={docId}
            saved={saveState === "saved" || saveState === "idle"}
            library={library}
            anchorId={activeAnchor}
          />
        ) : null}
        <button
          type="button"
          className="btn btn-primary min-h-11 px-3 text-sm"
          disabled={saveState === "saving"}
          title="保存（Ctrl+S）"
          onClick={() => saveNow()}
        >
          {saveState === "saving" ? "保存中…" : saveState === "saved" ? "已保存" : "保存"}
          <span className="ml-1 hidden text-[11px] font-normal opacity-80 sm:inline">Ctrl+S</span>
        </button>
        {docId === DOCS_LOCAL_ID && loggedIn ? (
          <button
            type="button"
            className="btn btn-secondary min-h-11 px-3 text-sm"
            onClick={() => void saveToCloud()}
          >
            保存到云端
          </button>
        ) : null}
        {docId === DOCS_LOCAL_ID && !loggedIn ? (
          <Link
            href="/login?next=/products/docs/local"
            className="btn btn-secondary min-h-11 px-3 text-sm"
          >
            登录后存到云端
          </Link>
        ) : null}
        {docId !== DOCS_LOCAL_ID ? (
          <button
            type="button"
            className="btn btn-secondary min-h-11 px-3 text-sm"
            onClick={() => void removeCloudDoc()}
          >
            删除
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-3 text-sm"
          onClick={() => openFileRef.current?.click()}
        >
          打开文件
        </button>
        <div className="relative">
          <button
            type="button"
            className={`btn min-h-11 px-3 text-sm ${saveAsOpen ? "btn-primary" : "btn-secondary"}`}
            aria-expanded={saveAsOpen}
            onClick={() => setSaveAsOpen((open) => !open)}
          >
            另存为
          </button>
          {saveAsOpen ? (
            <div className="absolute left-0 z-30 mt-1 min-w-[10rem] rounded-2xl border border-[var(--line)] bg-white p-2 shadow-lg">
              <button
                type="button"
                className="btn btn-secondary min-h-11 w-full justify-start px-3 text-sm"
                onClick={saveAsHtml}
              >
                HTML
              </button>
              <button
                type="button"
                className="btn btn-secondary mt-1 min-h-11 w-full justify-start px-3 text-sm"
                onClick={() => void saveAsDocx()}
              >
          Word（.docx，图片为占位）
              </button>
              <button
                type="button"
                className="btn btn-secondary mt-1 min-h-11 w-full justify-start px-3 text-sm"
                onClick={saveAsTxt}
              >
                纯文本
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-3 text-sm"
          onClick={() => setPrintOpen(true)}
        >
          打印预览
        </button>
        <input
          ref={openFileRef}
          type="file"
          accept=".docx,.wps,.doc,.html,.htm,.txt,.md"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onOpenFile(file);
          }}
        />
      </div>

      <label className="block border-b border-[var(--line)] px-3 py-3 sm:px-5">
        <span className="sr-only">文档标题</span>
        <input
          className="w-full bg-transparent text-xl font-semibold text-[var(--ink)] outline-none sm:text-2xl"
          value={title}
          maxLength={DOCS_TITLE_MAX_CHARS}
          onChange={(e) => {
            setTitle(e.target.value.slice(0, DOCS_TITLE_MAX_CHARS));
            setSaveState("dirty");
          }}
          placeholder="文档标题"
        />
      </label>

      <div className="docs-toolbar">
        <label className="sr-only" htmlFor="docs-heading">
          段落样式
        </label>
        <select
          id="docs-heading"
          className="field min-h-11 min-w-[7.5rem] rounded-xl px-3 text-sm"
          value={headingValue(editor)}
          onChange={(e) => {
            const level = Number(e.target.value);
            if (!editor) return;
            if (!level) editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
          }}
        >
          <option value="0">正文</option>
          <option value="1">标题 1</option>
          <option value="2">标题 2</option>
          <option value="3">标题 3</option>
          <option value="4">标题 4</option>
          <option value="5">标题 5</option>
          <option value="6">标题 6</option>
        </select>
        <button
          type="button"
          className={`btn min-h-11 px-3 text-sm ${
            editor?.isActive("bold") ? "btn-primary" : "btn-secondary"
          }`}
          onClick={() => run((current) => current.chain().toggleBold().run())}
        >
          加粗
        </button>
        <button
          type="button"
          className={`btn min-h-11 px-3 text-sm ${
            editor?.isActive("bulletList") ? "btn-primary" : "btn-secondary"
          }`}
          onClick={() => run((current) => current.chain().toggleBulletList().run())}
        >
          项目符号
        </button>
        <button
          type="button"
          className={`btn min-h-11 px-3 text-sm ${
            editor?.isActive("orderedList") ? "btn-primary" : "btn-secondary"
          }`}
          onClick={() => run((current) => current.chain().toggleOrderedList().run())}
        >
          项目编号
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-3 text-sm"
          onClick={() => run((current) => current.chain().liftListItem("listItem").run())}
        >
          升级
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-3 text-sm"
          onClick={() => run((current) => current.chain().sinkListItem("listItem").run())}
        >
          降级
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-3 text-sm"
          onClick={() => imageInputRef.current?.click()}
        >
          插图
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-3 text-sm"
          onClick={() =>
            run((current) =>
              current.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
            )
          }
        >
          表格
        </button>
        <button
          type="button"
          className={`btn min-h-11 px-3 text-sm ${schemeOpen ? "btn-primary" : "btn-secondary"}`}
          aria-pressed={schemeOpen}
          onClick={() => setSchemeOpen((open) => !open)}
        >
          编号样式
        </button>
        <button
          type="button"
          className={`btn min-h-11 px-3 text-sm ${pageOpen ? "btn-primary" : "btn-secondary"}`}
          aria-pressed={pageOpen}
          onClick={() => setPageOpen((open) => !open)}
        >
          页眉页脚
        </button>
        {inTable ? (
          <>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-3 text-sm"
              onClick={() => run((current) => current.chain().addRowAfter().run())}
            >
              加行
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-3 text-sm"
              onClick={() => run((current) => current.chain().addColumnAfter().run())}
            >
              加列
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-3 text-sm"
              onClick={() => run((current) => current.chain().deleteRow().run())}
            >
              删行
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-3 text-sm"
              onClick={() => run((current) => current.chain().deleteColumn().run())}
            >
              删列
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-3 text-sm"
              onClick={() => run((current) => current.chain().deleteTable().run())}
            >
              删表
            </button>
          </>
        ) : null}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onPickImage(file);
          }}
        />
      </div>

      {schemeOpen ? (
        <DocsSchemePanel scheme={scheme} onChange={markDirtyScheme} />
      ) : null}
      {pageOpen ? (
        <DocsPagePanel chrome={pageChrome} onChange={markDirtyChrome} />
      ) : null}

      {conflict ? (
        <p className="px-4 py-2 text-sm">
          {saveError}
          <button type="button" className="btn btn-secondary ml-2 min-h-11 px-3 text-sm" onClick={() => saveNow(true)}>
            仍用我的版本保存
          </button>
          <a className="btn btn-secondary ml-2 min-h-11 px-3 text-sm" href={`/products/docs/${docId}`} target="_blank" rel="noreferrer">
            另开最新版
          </a>
        </p>
      ) : saveError ? (
        <p className="px-4 py-2 text-sm text-[var(--fire)]">{saveError}</p>
      ) : null}
      {imageError ? (
        <p className="px-4 py-2 text-sm text-[var(--fire)]">
          {imageError}
          <button
            type="button"
            className="btn btn-secondary ml-2 min-h-11 px-3 text-sm"
            onClick={() => {
              const file = pendingImage.current;
              if (file) void onPickImage(file);
            }}
          >
            重试上传
          </button>
        </p>
      ) : null}
      {notice ? <p className="px-4 py-2 text-sm text-[var(--muted)]">{notice}</p> : null}
      <p className="px-4 pb-2 text-xs text-[var(--muted)]">
        每篇最多 {DOCS_CONTENT_MAX_CHARS.toLocaleString("zh-CN")} 字符，每人最多 {DOCS_MAX_PER_USER} 篇。超出时会提示，不会悄悄截断。
        Word 导出里的图片目前显示为“［图片］”。
      </p>

      {loggedIn && docId !== DOCS_LOCAL_ID ? (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2">
          {docTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className="btn btn-secondary min-h-11 px-3 text-sm"
              onClick={() =>
                void removeDocsTag(docId, tag.id)
                  .then(setLibrary)
                  .catch((error: unknown) => setSaveError(error instanceof Error ? error.message : "移除标签失败"))
              }
            >
              {tag.name} ×
            </button>
          ))}
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!tagName.trim()) return;
              void addDocsTag(docId, tagName)
                .then((next) => {
                  setLibrary(next);
                  setTagName("");
                })
                .catch((error: unknown) => setSaveError(error instanceof Error ? error.message : "添加标签失败"));
            }}
          >
            <input
              className="field min-h-11 rounded-xl px-3 text-sm"
              value={tagName}
              maxLength={24}
              placeholder="添加标签"
              aria-label="添加标签"
              onChange={(event) => setTagName(event.target.value)}
            />
            <button type="submit" className="btn btn-secondary min-h-11 px-3 text-sm">添加</button>
          </form>
        </div>
      ) : null}

      <style>{schemeCss}</style>
      <div className={mode === "read" ? "hidden" : undefined}>
        <EditorContent editor={editor} />
      </div>
      {mode === "read" ? (
        <DocsReader content={readContent} onZoom={(src, alt) => setZoom({ src, alt })} />
      ) : null}
      {zoom ? <DocsLightbox src={zoom.src} alt={zoom.alt} onClose={() => setZoom(null)} /> : null}
      {printOpen ? (
        <DocsPrintPreview
          title={title}
          content={currentContent()}
          listScheme={scheme}
          pageChrome={pageChrome}
          onClose={() => setPrintOpen(false)}
        />
      ) : null}
    </div>
      </div>
    </div>
  );
}
