import { useCallback, useRef } from "react";
import { firstImageFile, imageToDataUrl } from "../lib/richtext";
import type { Doc } from "../lib/types";

interface Props {
  doc: Doc;
  onUpdate(fields: Partial<Pick<Doc, "title" | "content">>): void;
}

/** A Google-Docs-lite editor: a plain contentEditable surface plus a small
 *  toolbar over execCommand — bold/italic, two heading levels, a bullet
 *  list, and images (pasted or attached, downscaled on the way in). The DOM
 *  owns the body's content between renders (contentEditable fighting a
 *  React-controlled value is a well-known way to lose the caret on every
 *  keystroke); a callback ref keyed on `doc.id` only re-seeds the innerHTML
 *  when the user actually switches documents. */
export default function DocEditor({ doc, onUpdate }: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-seed only on doc switch, not every content change
  const setBodyRef = useCallback(
    (el: HTMLDivElement | null) => {
      bodyRef.current = el;
      if (el) el.innerHTML = doc.content;
    },
    [doc.id],
  );

  const handleInput = () => {
    if (bodyRef.current) onUpdate({ content: bodyRef.current.innerHTML });
  };

  const exec = (cmd: string, value?: string) => {
    bodyRef.current?.focus();
    document.execCommand(cmd, false, value);
    handleInput();
  };

  const insertImage = async (file: File) => {
    const dataUrl = await imageToDataUrl(file);
    bodyRef.current?.focus();
    document.execCommand("insertImage", false, dataUrl);
    handleInput();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void insertImage(file);
  };

  // contentEditable's native Enter handling is notoriously inconsistent
  // across engines — especially right after a heading, where a browser can
  // just as easily glue the next line onto the same <h1> as start a fresh
  // block. Handling it explicitly (insertParagraph for Enter, a literal
  // line break for Shift+Enter) makes the split deterministic instead of
  // hoping the engine's default guesses right.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    document.execCommand("defaultParagraphSeparator", false, "p");
    document.execCommand(e.shiftKey ? "insertLineBreak" : "insertParagraph");
    handleInput();
  };

  // Paste always strips incoming formatting (images excepted) — a document
  // pulling in a foreign page's fonts and inline styles would stop feeling
  // like this editor's own, and "less options" was the point.
  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const imgFile = firstImageFile(e.clipboardData.items);
    if (imgFile) {
      e.preventDefault();
      void insertImage(imgFile);
      return;
    }
    const text = e.clipboardData.getData("text/plain");
    if (text) {
      e.preventDefault();
      document.execCommand("insertText", false, text);
      handleInput();
    }
  };

  const btn = (
    title: string,
    icon: string,
    onClick: () => void,
  ) => (
    <button
      key={title}
      type="button"
      className="btn btn-icon doc-tool"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <i className={icon} />
    </button>
  );

  return (
    <div className="doc-editor">
      <input
        className="input doc-title-input"
        value={doc.title}
        placeholder="Untitled document"
        onChange={(e) => onUpdate({ title: e.target.value })}
      />

      <div className="doc-toolbar">
        {btn("Bold", "ph ph-text-bolder", () => exec("bold"))}
        {btn("Italic", "ph ph-text-italic", () => exec("italic"))}
        <span className="doc-tool-sep" />
        {btn("Title", "ph ph-text-h-one", () => exec("formatBlock", "<h1>"))}
        {btn("Subtitle", "ph ph-text-h-two", () => exec("formatBlock", "<h2>"))}
        {btn("Normal text", "ph ph-text-t", () => exec("formatBlock", "<p>"))}
        <span className="doc-tool-sep" />
        {btn("Bullet list", "ph ph-list-bullets", () => exec("insertUnorderedList"))}
        {btn("Attach image", "ph ph-image", () => fileRef.current?.click())}
        <input ref={fileRef} type="file" accept="image/*" className="visually-hidden" onChange={onFileChange} />
      </div>

      <div
        className="doc-body"
        ref={setBodyRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Start writing…"
        onInput={handleInput}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
