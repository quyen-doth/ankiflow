"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FlashcardReviewLayout } from "@/components/review/FlashcardReviewLayout";
import { usePreviewEntry } from "@/hooks/usePreviewEntry";
import { useAnkiExport } from "@/hooks/useAnkiExport";
import { useCardMedia } from "@/hooks/useCardMedia";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Entry } from "@/types";

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
                        (deckSnap.data() as Record<string, string>).anki_deck_name || deckId;
                    setEntry((prev) => ({ ...prev, anki_deck: ankiDeckName }));
                }
            } catch (e) {
                console.error("Error fetching deck:", e);
            }
        },
        [setEntry],
    );

    const { confirmOpen, setConfirmOpen, isExporting, handleConfirm } = useAnkiExport({
        entry,
        selectedCardTypeIds,
        cardTypes,
    });

    const media = useCardMedia(entry, setEntry, !isLoading && !error);

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

    // Enter to confirm when modal is open
    useEffect(() => {
        if (!confirmOpen || isExporting) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleConfirm();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [confirmOpen, isExporting, handleConfirm]);

    const updateField = (field: keyof Entry, value: unknown) => {
        setEntry((prev) => ({ ...prev, [field]: value }));
    };

    const wordLabel = entry.word || entry.term || entry.title || "card";

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto mb-4" />
                    <p className="text-sm text-slate-600">Loading data...</p>
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

    return (
        <>
            <FlashcardReviewLayout
                headerLabel="Review Generation"
                headerActions={
                    <>
                        <Button variant="secondary" onClick={() => router.push("/create")} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                            Back
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => setConfirmOpen(true)}
                            disabled={isExporting || selectedCardTypeIds.length === 0}
                            leftIcon={<CheckCheck className="w-4 h-4" />}
                        >
                            {isExporting ? "Exporting..." : "Confirm & Create"}
                            {!isExporting && (
                                <kbd className="ml-1.5 text-[10px] opacity-60 font-mono">&#8984;&#9166;</kbd>
                            )}
                        </Button>
                    </>
                }
                entry={entry}
                updateField={updateField}
                images={media.images}
                imageLoading={media.imageLoading}
                onImageSelect={media.handleImageSelect}
                onImageUpload={media.handleImageUpload}
                onImageRefetch={() => media.fetchImages()}
                audioUrl={media.audioUrl}
                audioLoading={media.audioLoading}
                onAudioRegenerate={media.generateAudio}
                audioSubtitle={`Google TTS · ${entry.language || "en"}`}
                selectedDeckId={selectedDeckId}
                onDeckChange={handleDeckChange}
                cardTypes={cardTypes}
                selectedCardTypeIds={selectedCardTypeIds}
                onCardTypesChange={setSelectedCardTypeIds}
            />

            {/* Confirm Modal */}
            <Modal
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                title="Confirm Export to Anki"
                description={`Export "${wordLabel}" with ${selectedCardTypeIds.length} card type(s) to Anki?`}
            >
                <div className="flex gap-3 justify-end mt-2">
                    <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleConfirm}>
                        Confirm
                    </Button>
                </div>
            </Modal>
        </>
    );
}
