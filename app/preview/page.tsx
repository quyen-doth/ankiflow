"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EditableField } from "@/components/preview/EditableField";
import { CollocationEditor } from "@/components/preview/CollocationEditor";
import { ImageSelector } from "@/components/preview/ImageSelector";
import { AudioPlayer } from "@/components/preview/AudioPlayer";
import { CardPreview } from "@/components/preview/CardPreview";
import { CardList } from "@/components/preview/CardList";
import { DeckSelector } from "@/components/create/DeckSelector";
import { usePreviewEntry } from "@/hooks/usePreviewEntry";
import { useAnkiExport } from "@/hooks/useAnkiExport";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Entry } from "@/types";
import type { ImageItem } from "@/components/preview/ImageSelector";

export default function PreviewPage() {
    const router = useRouter();

    const {
        entry,
        setEntry,
        cardTypes,
        selectedCardTypeIds,
        setSelectedCardTypeIds,
        isLoading,
        error,
    } = usePreviewEntry();

    const [selectedDeckId, setSelectedDeckId] = useState("");

    const handleDeckChange = useCallback(
        async (deckId: string) => {
            setSelectedDeckId(deckId);
            try {
                const deckSnap = await getDoc(doc(db, "decks", deckId));
                if (deckSnap.exists()) {
                    const ankiDeckName =
                        (deckSnap.data() as Record<string, string>)
                            .anki_deck_name || deckId;
                    setEntry((prev) => ({ ...prev, anki_deck: ankiDeckName }));
                }
            } catch (e) {
                console.error("Error fetching deck:", e);
            }
        },
        [setEntry],
    );

    const { confirmOpen, setConfirmOpen, isExporting, handleConfirm } =
        useAnkiExport({
            entry,
            selectedCardTypeIds,
            cardTypes,
        });

    // --- Image state ---
    const [images, setImages] = useState<ImageItem[]>([]);
    const [imageLoading, setImageLoading] = useState(false);

    const fetchImages = useCallback(
        async (keyword?: string) => {
            const searchKeyword =
                keyword ||
                ((entry as Record<string, unknown>)
                    .unsplash_search_keyword as string);
            if (!searchKeyword) return;
            setImageLoading(true);
            try {
                const res = await fetch(
                    `/api/image?keyword=${encodeURIComponent(searchKeyword)}&count=5`,
                );
                if (res.ok) {
                    const data = await res.json();
                    setImages(data.images ?? []);
                }
            } catch (err) {
                console.error("Image fetch error:", err);
            } finally {
                setImageLoading(false);
            }
        },
        [entry],
    );

    // --- Audio state ---
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioLoading, setAudioLoading] = useState(false);

    const generateAudio = useCallback(async () => {
        const text = entry.word || entry.term || entry.title;
        const language = entry.language;
        if (!text) return;
        setAudioLoading(true);
        try {
            const res = await fetch("/api/audio/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text,
                    language: language || "en",
                    filename: `ankiflow_${text.replace(/[\s/\\:*?"<>|]/g, "_")}.mp3`,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                const dataUrl = `data:audio/mp3;base64,${data.base64}`;
                setAudioUrl(dataUrl);
                setEntry((prev) => ({ ...prev, audio_url: dataUrl }));
            }
        } catch (err) {
            console.error("Audio generation error:", err);
        } finally {
            setAudioLoading(false);
        }
    }, [entry.word, entry.term, entry.title, entry.language, setEntry]);

    // Auto-fetch on load
    useEffect(() => {
        if (isLoading || error) return;
        const keyword = (entry as Record<string, unknown>)
            .unsplash_search_keyword as string;
        if (keyword && images.length === 0) fetchImages(keyword);
    }, [isLoading, error]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (isLoading || error) return;
        const text = entry.word || entry.term || entry.title;
        if (text && !audioUrl) generateAudio();
    }, [isLoading, error]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keyboard shortcut: Cmd+Enter / Ctrl+Enter to open confirm modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                if (!isExporting && selectedCardTypeIds.length > 0) {
                    setConfirmOpen(true);
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isExporting, selectedCardTypeIds.length, setConfirmOpen]);

    const updateField = (field: keyof Entry, value: unknown) => {
        setEntry((prev) => ({ ...prev, [field]: value }));
    };

    const handleImageSelect = (img: ImageItem) => {
        setEntry((prev) => ({
            ...prev,
            image_url: img.url,
            image_credit: `${img.credit_name} on Unsplash`,
        }));
    };

    const handleImageUpload = (dataUrl: string) => {
        setEntry((prev) => ({
            ...prev,
            image_url: dataUrl,
            image_credit: "",
        }));
    };

    const wordLabel = entry.word || entry.term || entry.title || "card";

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto mb-4" />
                    <p className="text-sm text-slate-600">
                        Loading data...
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center max-w-md">
                    <p className="text-lg font-semibold text-ink mb-2">
                        Data not found
                    </p>
                    <p className="text-sm text-slate-600 mb-6">{error}</p>
                    <Button
                        variant="primary"
                        onClick={() => router.push("/create")}
                    >
                        Back to Create
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto w-full pb-24">
            <PageHeader
                crumbs={[
                    { label: "Flashcard Preview", href: "/create" },
                    { label: "Review Generation" },
                ]}
                // title="Vocabulary Data"
                // description="Refine AI-generated fields before syncing to your deck."
                // actions={<Badge variant="ai">AI VALIDATED</Badge>}
            />

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* ── LEFT PANEL: Vocabulary Data ── */}
                <div className="md:col-span-8 flex flex-col gap-6">
                    {/* Main fields card */}
                    <section className="bg-white rounded-card border border-border/40 p-6">
                        {/* Row 1: Word + Reading */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                            <div>
                                <p className="text-overline uppercase text-slate-600 tracking-wider font-bold mb-1.5">
                                    Word
                                </p>
                                <EditableField
                                    value={
                                        entry.word ||
                                        entry.term ||
                                        entry.title ||
                                        ""
                                    }
                                    onSave={(v) => updateField("word", v)}
                                    className="text-section-heading font-extrabold text-ink"
                                />
                            </div>
                            <div>
                                <p className="text-overline uppercase text-slate-600 tracking-wider font-bold mb-1.5">
                                    Reading
                                </p>
                                <EditableField
                                    value={
                                        entry.hiragana ||
                                        entry.pinyin ||
                                        entry.ipa ||
                                        ""
                                    }
                                    onSave={(v) => updateField("hiragana", v)}
                                    className="text-body text-slate-600"
                                />
                            </div>
                        </div>

                        {/* Row 2: Meaning + Word Type / Level */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 mt-5">
                            <div>
                                <p className="text-overline uppercase text-slate-600 tracking-wider font-bold mb-1.5">
                                    Meaning
                                </p>
                                <EditableField
                                    value={
                                        entry.meaning_vi ||
                                        entry.definition ||
                                        ""
                                    }
                                    onSave={(v) => updateField("meaning_vi", v)}
                                    className="text-body text-ink"
                                />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <p className="text-overline uppercase text-slate-600 tracking-wider font-bold mb-1.5">
                                        Word Type
                                    </p>
                                    <EditableField
                                        value={entry.word_type || ""}
                                        onSave={(v) =>
                                            updateField("word_type", v)
                                        }
                                        className="text-body text-slate-600"
                                        placeholder="Noun, Verb..."
                                    />
                                </div>
                                {typeof (entry as Record<string, unknown>)
                                    .level === "string" && (
                                    <div>
                                        <p className="text-overline uppercase text-slate-600 tracking-wider font-bold mb-1.5">
                                            Level
                                        </p>
                                        <Badge variant="level">
                                            {
                                                (
                                                    entry as Record<
                                                        string,
                                                        string
                                                    >
                                                ).level
                                            }
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-border/30 my-6" />

                        {/* Example Sentence */}
                        <div>
                            <p className="text-overline uppercase text-slate-600 tracking-wider font-bold mb-1.5">
                                Example Sentence
                            </p>
                            <div className="flex items-start gap-3">
                                <div className="flex-1">
                                    <EditableField
                                        value={entry.example_sentence || ""}
                                        onSave={(v) =>
                                            updateField("example_sentence", v)
                                        }
                                        multiline
                                        className="text-body text-ink"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Translation */}
                        <div className="mt-4">
                            <p className="text-overline uppercase text-slate-600 tracking-wider font-bold mb-1.5">
                                Translation
                            </p>
                            <EditableField
                                value={entry.example_translation || ""}
                                onSave={(v) =>
                                    updateField("example_translation", v)
                                }
                                multiline
                                className="text-body text-slate-600 italic"
                            />
                        </div>

                        {/* Divider */}
                        <div className="border-t border-border/30 my-6" />

                        {/* Collocations */}
                        <CollocationEditor
                            items={entry.collocations || []}
                            onChange={(v) => updateField("collocations", v)}
                        />
                    </section>

                    {/* Image Reference */}
                    <section className="bg-white rounded-card border border-border/40 p-6">
                        <ImageSelector
                            images={images}
                            selectedUrl={entry.image_url || null}
                            onSelect={handleImageSelect}
                            onRefetch={() => fetchImages()}
                            onUpload={handleImageUpload}
                            loading={imageLoading}
                        />
                    </section>

                    {/* Audio */}
                    <section className="bg-white rounded-card border border-border/40 p-6">
                        <AudioPlayer
                            audioUrl={audioUrl}
                            onRegenerate={generateAudio}
                            loading={audioLoading}
                        />
                    </section>
                </div>

                {/* ── RIGHT PANEL: Card Preview + Controls ── */}
                <div className="md:col-span-4">
                    <div className="sticky top-8 flex flex-col gap-4">
                        {/* Card Preview */}
                        <div className="bg-white rounded-card border border-border/40 p-6">
                            <CardPreview entry={entry} audioUrl={audioUrl} />
                        </div>

                        {/* Target Deck */}
                        <div className="bg-white rounded-card border border-border/40 px-5 py-4">
                            <DeckSelector
                                value={selectedDeckId}
                                onChangeId={handleDeckChange}
                                label="Target Deck"
                            />
                            {entry.anki_deck && (
                                <p className="text-overline text-slate-600 mt-1.5 truncate">
                                    Anki: {entry.anki_deck}
                                </p>
                            )}
                        </div>

                        {/* Card Types */}
                        <div className="bg-white rounded-card border border-border/40 p-5">
                            <CardList
                                cardTypes={cardTypes}
                                selectedIds={selectedCardTypeIds}
                                onChange={setSelectedCardTypeIds}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── FOOTER BAR ── */}
            <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-white border-t border-border/40 z-30">
                <div className="max-w-6xl mx-auto w-full px-6 md:px-8 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push("/create")}
                        >
                            <ArrowLeft className="w-4 h-4 mr-1.5" />
                            Back
                        </Button>
                    </div>
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={() => setConfirmOpen(true)}
                        disabled={
                            isExporting || selectedCardTypeIds.length === 0
                        }
                    >
                        {isExporting ? "Exporting..." : "Confirm & Create"}
                        {!isExporting && (
                            <kbd className="ml-1.5 text-[10px] opacity-60 font-mono">
                                &#8984;&#9166;
                            </kbd>
                        )}
                    </Button>
                </div>
            </div>

            {/* Confirm Modal */}
            <Modal
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                title="Confirm Export to Anki"
                description={`Export "${wordLabel}" with ${selectedCardTypeIds.length} card type(s) to Anki?`}
            >
                <div className="flex gap-3 justify-end mt-2">
                    <Button
                        variant="ghost"
                        onClick={() => setConfirmOpen(false)}
                    >
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleConfirm}>
                        Confirm
                    </Button>
                </div>
            </Modal>
        </div>
    );
}
