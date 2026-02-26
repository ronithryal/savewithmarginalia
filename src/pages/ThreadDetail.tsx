import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ArrowLeft, Plus, GripVertical, Trash2, FileText, Quote as QuoteIcon } from "lucide-react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ThreadRow {
    id: string;
    title: string;
    description: string | null;
    tag_id: string | null;
    user_id: string;
    created_at: string;
    updated_at: string;
    tags?: { name: string } | null;
}

interface RawItemRow {
    id: string;
    thread_id: string;
    item_type: string;
    article_id: string | null;
    quote_id: string | null;
    position: number;
    note: string | null;
    created_at: string;
}

interface ArticleRow {
    id: string;
    title: string;
    source_domain: string;
    url: string;
}

interface QuoteRow {
    id: string;
    text: string;
    articles?: { id: string; title: string; source_domain: string } | null;
}

interface ItemBlock extends RawItemRow {
    article?: ArticleRow | null;
    quote?: QuoteRow | null;
}

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

// ─── Inline Note Field ────────────────────────────────────────────────────────

function NoteField({
    itemId,
    initialNote,
}: {
    itemId: string;
    initialNote: string | null;
}) {
    const [note, setNote] = useState(initialNote ?? "");
    const [editing, setEditing] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (editing) inputRef.current?.focus();
    }, [editing]);

    const save = async () => {
        setEditing(false);
        const trimmed = note.trim();
        if (trimmed === (initialNote ?? "")) return;
        await (supabase as any)
            .from("thread_items")
            .update({ note: trimmed || null })
            .eq("id", itemId);
    };

    if (!editing && !note) {
        return (
            <button
                onClick={() => setEditing(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
                + Add note
            </button>
        );
    }

    if (editing) {
        return (
            <textarea
                ref={inputRef}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => {
                    if (e.key === "Escape") { setNote(initialNote ?? ""); setEditing(false); }
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
                }}
                placeholder="Add a note…"
                className="mt-1 w-full text-xs text-muted-foreground bg-transparent border-b border-accent outline-none resize-none leading-relaxed"
            />
        );
    }

    return (
        <p
            onClick={() => setEditing(true)}
            className="mt-1 text-xs text-muted-foreground border-l-2 border-border pl-2 cursor-text hover:border-accent transition-colors leading-relaxed"
        >
            {note}
        </p>
    );
}

// ─── Sortable Item Block ──────────────────────────────────────────────────────

function SortableItem({
    block,
    onDelete,
}: {
    block: ItemBlock;
    onDelete: (id: string) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: block.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
    };

    const isArticle = block.item_type === "article";
    const title = isArticle
        ? block.article?.title || "Untitled article"
        : block.quote?.text?.slice(0, 140) || "Untitled quote";
    const sub = isArticle
        ? block.article?.source_domain ?? ""
        : block.quote?.articles?.title ?? "";

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="group flex items-start gap-3 bg-[hsl(var(--article-card))] border border-[hsl(var(--article-card-border))] rounded-lg p-4"
        >
            {/* Drag handle */}
            <button
                {...attributes}
                {...listeners}
                className="mt-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
                aria-label="Drag to reorder"
            >
                <GripVertical className="h-4 w-4" />
            </button>

            {/* Type icon */}
            <div className="mt-0.5 text-muted-foreground flex-shrink-0">
                {isArticle ? <FileText className="h-4 w-4" /> : <QuoteIcon className="h-4 w-4" />}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
                {isArticle && block.article ? (
                    <a
                        href={block.article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-display text-sm font-semibold text-foreground hover:text-accent transition-colors line-clamp-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {title}
                    </a>
                ) : (
                    <p className="text-sm text-foreground italic leading-relaxed line-clamp-3">
                        &ldquo;{title}&rdquo;
                    </p>
                )}
                {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
                <NoteField itemId={block.id} initialNote={block.note} />
            </div>

            {/* Delete */}
            <button
                onClick={() => onDelete(block.id)}
                className="mt-0.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                aria-label="Remove item"
            >
                <Trash2 className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

// ─── Add Item Modal ───────────────────────────────────────────────────────────

type PickerTab = "article" | "quote";

function AddItemModal({
    open,
    onClose,
    onAdd,
}: {
    open: boolean;
    onClose: () => void;
    onAdd: (type: PickerTab, id: string) => Promise<void>;
}) {
    const [tab, setTab] = useState<PickerTab>("article");
    const [query, setQuery] = useState("");
    const debouncedQuery = useDebounce(query, 250);
    const [submitting, setSubmitting] = useState<string | null>(null);

    // Reset on re-open
    useEffect(() => {
        if (open) { setQuery(""); setTab("article"); }
    }, [open]);

    const { data: articles } = useQuery(debouncedQuery, "articles", open && tab === "article");
    const { data: quotes } = useQuery(debouncedQuery, "quotes", open && tab === "quote");

    const handlePick = async (type: PickerTab, id: string) => {
        setSubmitting(id);
        await onAdd(type, id);
        setSubmitting(null);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-lg flex flex-col max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle>Add item to thread</DialogTitle>
                    <DialogDescription>Search your articles and quotes.</DialogDescription>
                </DialogHeader>

                {/* Tabs */}
                <div className="flex gap-2 mt-1">
                    {(["article", "quote"] as PickerTab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => { setTab(t); setQuery(""); }}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${tab === t
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                }`}
                        >
                            {t === "article" ? "Articles" : "Quotes"}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <input
                    type="search"
                    placeholder={`Search ${tab === "article" ? "articles" : "quotes"}…`}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="mt-2 w-full px-3 py-2 text-sm bg-muted rounded-md border border-border outline-none focus:ring-1 focus:ring-accent"
                />

                {/* Results */}
                <div className="flex-1 overflow-y-auto min-h-0 space-y-1 mt-1 pr-0.5">
                    {tab === "article" &&
                        (articles ?? []).map((a: any) => (
                            <button
                                key={a.id}
                                disabled={!!submitting}
                                onClick={() => handlePick("article", a.id)}
                                className="w-full text-left px-3 py-2.5 rounded-md hover:bg-muted transition-colors flex items-start gap-2 disabled:opacity-50"
                            >
                                <FileText className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground line-clamp-1">{a.title || "Untitled"}</p>
                                    <p className="text-xs text-muted-foreground">{a.source_domain}</p>
                                </div>
                                {submitting === a.id && <span className="ml-auto text-xs text-muted-foreground">Adding…</span>}
                            </button>
                        ))}

                    {tab === "quote" &&
                        (quotes ?? []).map((q: any) => (
                            <button
                                key={q.id}
                                disabled={!!submitting}
                                onClick={() => handlePick("quote", q.id)}
                                className="w-full text-left px-3 py-2.5 rounded-md hover:bg-muted transition-colors flex items-start gap-2 disabled:opacity-50"
                            >
                                <QuoteIcon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm text-foreground italic line-clamp-2">&ldquo;{q.text}&rdquo;</p>
                                    {q.articles?.title && (
                                        <p className="text-xs text-muted-foreground mt-0.5">{q.articles.title}</p>
                                    )}
                                </div>
                                {submitting === q.id && <span className="ml-auto text-xs text-muted-foreground">Adding…</span>}
                            </button>
                        ))}

                    {tab === "article" && (articles ?? []).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6">No articles found.</p>
                    )}
                    {tab === "quote" && (quotes ?? []).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6">No quotes found.</p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Simple internal hook used only by AddItemModal
function useQuery(search: string, type: "articles" | "quotes", enabled: boolean) {
    const [data, setData] = useState<any[]>([]);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        (async () => {
            if (type === "articles") {
                const q = supabase
                    .from("articles")
                    .select("id, title, source_domain, url")
                    .order("created_at", { ascending: false })
                    .limit(50);
                if (search) q.ilike("title", `%${search}%`);
                const { data } = await q;
                if (!cancelled) setData(data ?? []);
            } else {
                const q = (supabase as any)
                    .from("quotes")
                    .select("id, text, articles(id, title, source_domain)")
                    .order("created_at", { ascending: false })
                    .limit(50);
                if (search) q.ilike("text", `%${search}%`);
                const { data } = await q;
                if (!cancelled) setData(data ?? []);
            }
        })();
        return () => { cancelled = true; };
    }, [search, type, enabled]);

    return { data };
}

// ─── ThreadDetail ─────────────────────────────────────────────────────────────

const ThreadDetail = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();

    const [thread, setThread] = useState<ThreadRow | null>(null);
    const [items, setItems] = useState<ItemBlock[]>([]);
    const [loading, setLoading] = useState(true);
    const [addOpen, setAddOpen] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // ── Load thread ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user || !id) return;
        (async () => {
            const { data, error } = await (supabase as any)
                .from("threads")
                .select("*, tags(name)")
                .eq("id", id)
                .eq("user_id", user.id)
                .single();
            if (!error) setThread(data);
            setLoading(false);
        })();
    }, [id, user]);

    // ── Load items ───────────────────────────────────────────────────────────────
    const loadItems = useCallback(async () => {
        if (!id) return;
        const { data: rawItems, error } = await (supabase as any)
            .from("thread_items")
            .select("*")
            .eq("thread_id", id)
            .order("position", { ascending: true });
        if (error || !rawItems) return;

        const articleIds = rawItems.filter((r: any) => r.article_id).map((r: any) => r.article_id);
        const quoteIds = rawItems.filter((r: any) => r.quote_id).map((r: any) => r.quote_id);

        const [articlesRes, quotesRes] = await Promise.all([
            articleIds.length > 0
                ? supabase.from("articles").select("id, title, source_domain, url").in("id", articleIds)
                : Promise.resolve({ data: [] }),
            quoteIds.length > 0
                ? (supabase as any).from("quotes").select("id, text, articles(id, title, source_domain)").in("id", quoteIds)
                : Promise.resolve({ data: [] }),
        ]);

        const articleMap = new Map((articlesRes.data ?? []).map((a: ArticleRow) => [a.id, a]));
        const quoteMap = new Map((quotesRes.data ?? []).map((q: QuoteRow) => [q.id, q]));

        setItems(
            rawItems.map((r: RawItemRow) => ({
                ...r,
                article: r.article_id ? (articleMap.get(r.article_id) ?? null) : null,
                quote: r.quote_id ? (quoteMap.get(r.quote_id) ?? null) : null,
            }))
        );
    }, [id]);

    useEffect(() => { loadItems(); }, [loadItems]);

    // ── Drag end ─────────────────────────────────────────────────────────────────
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIdx = items.findIndex((i) => i.id === active.id);
        const newIdx = items.findIndex((i) => i.id === over.id);
        const reordered = arrayMove(items, oldIdx, newIdx);
        setItems(reordered);

        // Batch update positions
        await Promise.all(
            reordered.map((item, idx) =>
                (supabase as any).from("thread_items").update({ position: idx }).eq("id", item.id)
            )
        );
    };

    // ── Delete item ──────────────────────────────────────────────────────────────
    const handleDelete = async (itemId: string) => {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        await (supabase as any).from("thread_items").delete().eq("id", itemId);
    };

    // ── Add item ─────────────────────────────────────────────────────────────────
    const handleAdd = async (type: PickerTab, pickedId: string) => {
        const position = items.length;
        const { data, error } = await (supabase as any)
            .from("thread_items")
            .insert({
                thread_id: id,
                item_type: type,
                article_id: type === "article" ? pickedId : null,
                quote_id: type === "quote" ? pickedId : null,
                position,
                note: null,
            })
            .select("*")
            .single();
        if (!error && data) await loadItems();
    };

    // ── Render ───────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="mx-auto max-w-[700px] px-6 py-16">
                <p className="text-muted-foreground text-sm">Loading…</p>
            </div>
        );
    }

    if (!thread) {
        return (
            <div className="mx-auto max-w-[700px] px-6 py-16">
                <p className="text-muted-foreground text-sm">Thread not found.</p>
            </div>
        );
    }

    const tagName = (thread as any).tags?.name as string | null;
    const formattedDate = format(new Date(thread.updated_at), "MMMM d, yyyy");

    return (
        <div className="mx-auto max-w-[700px] px-6 py-16 animate-fade-in">
            {/* Back link */}
            <Link
                to={tagName ? `/tags/${encodeURIComponent(tagName)}?filter=threads` : "/tags"}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                {tagName ? `Back to #${tagName}` : "Back to tags"}
            </Link>

            {/* Header */}
            <div className="mb-8">
                <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-1">
                    {thread.title || "Untitled thread"}
                </h1>
                {thread.description && (
                    <p className="text-sm text-muted-foreground mb-2">{thread.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                    {items.length} {items.length === 1 ? "item" : "items"} · updated {formattedDate}
                </p>
            </div>

            {/* Items list */}
            {items.length > 0 ? (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-3 mb-6">
                            {items.map((block) => (
                                <SortableItem key={block.id} block={block} onDelete={handleDelete} />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            ) : (
                <p className="text-muted-foreground text-sm py-10 text-center mb-6">
                    No items yet — add your first article or quote below.
                </p>
            )}

            {/* Add item button */}
            <button
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
                <Plus className="h-4 w-4" />
                Add item
            </button>

            <AddItemModal
                open={addOpen}
                onClose={() => setAddOpen(false)}
                onAdd={handleAdd}
            />
        </div>
    );
};

export default ThreadDetail;
