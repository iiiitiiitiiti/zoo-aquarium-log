import DOMPurify from "dompurify";
import { marked } from "marked";

export function renderMarkdown(source: string) {
  const html = marked.parse(source, {
    gfm: true,
    breaks: true,
    async: false,
  });
  return DOMPurify.sanitize(String(html), {
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed"],
    FORBID_ATTR: ["style", "onerror", "onclick", "onload"],
  });
}
