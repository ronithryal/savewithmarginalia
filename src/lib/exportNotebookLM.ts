/**
 * Formats all articles and quotes under a tag into structured markdown
 * suitable for pasting into NotebookLM as a source.
 */
export function formatNotebookLMExport(
    tagName: string,
    articles: Array<{ title: string; source_domain?: string | null; og_description?: string | null; content_text?: string | null }>,
    quotes: Array<{ text: string; articles?: { title: string } | null }>
): string {
    const lines: string[] = [];

    lines.push(`# ${tagName} — Marginalia Export`);
    lines.push(`*Exported from Marginalia on ${new Date().toLocaleDateString()}*`);
    lines.push("");

    if (articles.length > 0) {
        lines.push("## Articles");
        for (const a of articles) {
            lines.push(`### ${a.title}${a.source_domain ? ` (${a.source_domain})` : ""}`);
            const summary = a.og_description || (a.content_text ? a.content_text.slice(0, 500) + "…" : null);
            if (summary) lines.push(summary);
            lines.push("");
        }
    }

    if (quotes.length > 0) {
        lines.push("## Quotes");
        for (const q of quotes) {
            const source = q.articles?.title ? ` — ${q.articles.title}` : "";
            lines.push(`- "${q.text}"${source}`);
        }
        lines.push("");
    }

    return lines.join("\n");
}

export async function copyAndOpenNotebookLM(markdown: string): Promise<void> {
    await navigator.clipboard.writeText(markdown);
    window.open("https://notebooklm.google.com", "_blank");
}
