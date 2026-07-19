"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCheck, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FlashcardReviewLayout } from "@/components/review/FlashcardReviewLayout";
import { BatchNavStrip } from "@/components/review/BatchNavStrip";
import { ValidationBanner } from "@/components/review/ValidationBanner";
import { MotionPage } from "@/components/ui/MotionPage";
import { usePreviewBatch } from "@/hooks/usePreviewBatch";
import { useBatchAnkiExport } from "@/hooks/useBatchAnkiExport";
import { useAnkiConnection } from "@/hooks/useAnkiConnection";
import { useCardMedia } from "@/hooks/useCardMedia";
import { useStudyLanguages } from "@/components/providers/StudyLanguageProvider";
import { resolveCustomFields } from "@/lib/entryCustomFields";
import { languageDisplayName } from "@/lib/studyLanguages";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Entry, CardTypeConfig, UserContentType } from "@/types";

type CardTypeItem = Pick<CardTypeConfig, "id" | "name" | "description" | "code">;

// ── 表示中カードの Reviewer ──────────────────────────────────────────────
// component に分離して parent 側で key={activeIndex} を付ける → カード切替で remount し、
// useCardMedia が新カードに対して再実行される (lazy)。生成済み audio は配列内の entry に
// 保存されるため、戻ってきても再生成しない (cached)。
interface BatchCardReviewerProps {
    entry: Partial<Entry>;
    setEntry: React.Dispatch<React.SetStateAction<Partial<Entry>>>;
    contentType: UserContentType | null;
    updateField: (field: keyof Entry, value: unknown) => void;
    cardTypes: CardTypeItem[];
    selectedCardTypeIds: string[];
    onCardTypesChange: (ids: string[]) => void;
    selectedDeckId: string;
    onDeckChange: (deckId: string) => void;
    onDeckClear: () => void;
    headerLabel: string;
    headerActions: React.ReactNode;
    subHeader: React.ReactNode;
    banner?: React.ReactNode;
}

function BatchCardReviewer({
    entry,
    setEntry,
    contentType,
    updateField,
    cardTypes,
    selectedCardTypeIds,
    onCardTypesChange,
    selectedDeckId,
    onDeckChange,
    onDeckClear,
    headerLabel,
    headerActions,
    subHeader,
    banner,
}: BatchCardReviewerProps) {
    const media = useCardMedia(entry, setEntry, !!entry);
    const { languages } = useStudyLanguages();
    const customFields = resolveCustomFields(entry, contentType ?? undefined);

    return (
        <FlashcardReviewLayout
            headerLabel={headerLabel}
            headerActions={headerActions}
            subHeader={subHeader}
            banner={banner}
            entry={entry}
            updateField={updateField}
            customFields={customFields}
            onCustomFieldChange={(key, value) => {
                setEntry((prev) => ({ ...prev, [key]: value }));
            }}
            images={media.images}
            imageLoading={media.imageLoading}
            onImageSelect={media.handleImageSelect}
            onImageUpload={media.handleImageUpload}
            onImageRefetch={() => media.fetchImages()}
            audioUrl={media.audioUrl}
            audioLoading={media.audioLoading}
            onAudioRegenerate={media.generateAudio}
            audioSubtitle={entry.language ? `Google TTS · ${languageDisplayName(entry.language, languages)}` : undefined}
            selectedDeckId={selectedDeckId}
            onDeckChange={onDeckChange}
            onDeckClear={onDeckClear}
            cardTypes={cardTypes}
            selectedCardTypeIds={selectedCardTypeIds}
            onCardTypesChange={onCardTypesChange}
        />
    );
}

// ── Trang review batch ─────────────────────────────────────────────────────
export default function BatchPreviewPage() {
    const router = useRouter();

    const {
        entries,
        setEntries,
        contentType,
        cardTypes,
        selectedCardTypeIds,
        setSelectedCardTypeIds,
        selectedDeckId,
        setSelectedDeckId,
        isLoading,
        error,
    } = usePreviewBatch();

    const [activeIndex, setActiveIndex] = useState(0);

    const total = entries.length;
    const activeEntry = entries[activeIndex] ?? {};

    const updateActiveField = useCallback(
        (field: keyof Entry, value: unknown) => {
            setEntries((prev) => prev.map((e, i) => (i === activeIndex ? { ...e, [field]: value } : e)));
        },
        [activeIndex, setEntries],
    );

    // useCardMedia 用の setEntry: 配列の active 要素へ書き込む。
    const setActiveEntry: React.Dispatch<React.SetStateAction<Partial<Entry>>> = useCallback(
        (update) => {
            setEntries((prev) =>
                prev.map((e, i) => {
                    if (i !== activeIndex) return e;
                    return typeof update === "function"
                        ? (update as (p: Partial<Entry>) => Partial<Entry>)(e)
                        : update;
                }),
            );
        },
        [activeIndex, setEntries],
    );

    // Deck & card types は batch 全体で共有。
    const handleDeckChange = useCallback(
        async (deckId: string) => {
            setSelectedDeckId(deckId);
            let ankiDeckName = deckId;
            try {
                const deckSnap = await getDoc(doc(db, "decks", deckId));
                if (deckSnap.exists()) {
                    ankiDeckName = (deckSnap.data() as Record<string, string>).anki_deck_name || deckId;
                }
            } catch (e) {
                console.error("Error fetching deck:", e);
            }
            setEntries((prev) => prev.map((e) => ({ ...e, anki_deck: ankiDeckName })));
        },
        [setEntries, setSelectedDeckId],
    );

    const handleDeckClear = useCallback(() => {
        setSelectedDeckId("");
        setEntries((prev) => prev.map((e) => ({ ...e, anki_deck: "" })));
    }, [setEntries, setSelectedDeckId]);

    const { confirmOpen, setConfirmOpen, isExporting, isSaving, progress, invalid, clearInvalid, requestExport, handleExportAll, handleSaveAll } =
        useBatchAnkiExport({
            entries,
            selectedCardTypeIds,
            cardTypes,
            onInvalid: setActiveIndex,
        });

    const ankiConnected = useAnkiConnection();

    const goPrev = useCallback(() => setActiveIndex((i) => Math.max(0, i - 1)), []);
    const goNext = useCallback(() => setActiveIndex((i) => Math.min(total - 1, i + 1)), [total]);

    // キーボード: Tab = 次のカード、Shift+Tab = 前のカード (field 入力中でない時);
    // ⌘↵ で export を開く; modal 表示中は Enter。
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                if (!isExporting) requestExport();
                return;
            }
            if (e.key !== "Tab") return;
            const el = document.activeElement;
            const typing = el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
            if (typing) return; // 編集中 → Tab は通常どおり field の focus 移動
            e.preventDefault();
            if (e.shiftKey) goPrev();
            else goNext();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isExporting, requestExport, goPrev, goNext]);

    useEffect(() => {
        if (!confirmOpen || isExporting) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleExportAll();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [confirmOpen, isExporting, handleExportAll]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto mb-4" />
                    <p className="text-sm text-slate-600">Loading batch...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center max-w-md">
                    <p className="text-lg font-semibold text-ink mb-2">Data not found</p>
                    <p className="text-sm text-slate-600 mb-6">{error}</p>
                    <Button variant="primary" onClick={() => router.push("/create")}>
                        Back to Create
                    </Button>
                </div>
            </div>
        );
    }

    const headerActions = (
        <>
            <Button variant="secondary" onClick={() => router.push("/create")} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back
            </Button>
            <Button variant="ghost" onClick={goPrev} disabled={activeIndex === 0} leftIcon={<ChevronLeft className="w-4 h-4" />}>
                Prev
            </Button>
            <Button variant="ghost" onClick={goNext} disabled={activeIndex >= total - 1} leftIcon={<ChevronRight className="w-4 h-4" />}>
                Next
            </Button>
            <Button
                variant="secondary"
                onClick={handleSaveAll}
                disabled={isSaving || isExporting}
                leftIcon={<Save className="w-4 h-4" />}
            >
                {isSaving ? "Saving..." : `Save all (${total})`}
            </Button>
            <Button
                variant="primary"
                onClick={requestExport}
                disabled={isExporting || isSaving || !ankiConnected}
                leftIcon={<CheckCheck className="w-4 h-4" />}
                title={ankiConnected ? undefined : "Anki is not connected"}
            >
                {isExporting ? `Exporting ${progress.done}/${progress.total}...` : `Save & Export (${total})`}
                {!isExporting && <kbd className="ml-1.5 text-[10px] opacity-60 font-mono">&#8984;&#9166;</kbd>}
            </Button>
        </>
    );

    const subHeader = (
        <div>
            <div className="flex items-center justify-between mb-3">
                <p className="text-meta font-mono uppercase tracking-[0.05em] font-bold text-slate-400">
                    Reviewing card {activeIndex + 1} of {total}
                </p>
                <p className="text-[12px] font-mono text-slate-400">Tab / Shift+Tab to switch cards</p>
            </div>
            <BatchNavStrip
                entries={entries}
                selectedCardTypeIds={selectedCardTypeIds}
                activeIndex={activeIndex}
                onSelect={setActiveIndex}
            />
        </div>
    );

    return (
        <MotionPage>
            <BatchCardReviewer
                key={activeIndex}
                entry={activeEntry}
                setEntry={setActiveEntry}
                contentType={contentType}
                updateField={updateActiveField}
                cardTypes={cardTypes}
                selectedCardTypeIds={selectedCardTypeIds}
                onCardTypesChange={setSelectedCardTypeIds}
                selectedDeckId={selectedDeckId}
                onDeckChange={handleDeckChange}
                onDeckClear={handleDeckClear}
                headerLabel="Review Batch"
                headerActions={headerActions}
                subHeader={subHeader}
                banner={
                    invalid.length > 0 ? (
                        <ValidationBanner invalid={invalid} onJump={setActiveIndex} onDismiss={clearInvalid} />
                    ) : null
                }
            />

            <Modal
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                title="Save & Export to Anki"
                description={`Save and export all ${total} card(s) with ${selectedCardTypeIds.length} card type(s) each to Anki?`}
            >
                <div className="flex gap-3 justify-end mt-2">
                    <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleExportAll}>
                        Confirm
                    </Button>
                </div>
            </Modal>
        </MotionPage>
    );
}
