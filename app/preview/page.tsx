"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCheck, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FlashcardReviewLayout } from "@/components/review/FlashcardReviewLayout";
import { MotionPage } from "@/components/ui/MotionPage";
import { usePreviewEntry } from "@/hooks/usePreviewEntry";
import { useAnkiExport, saveEntryToFirestore } from "@/hooks/useAnkiExport";
import { useAnkiConnection } from "@/hooks/useAnkiConnection";
import { useCardMedia } from "@/hooks/useCardMedia";
import { useToast } from "@/components/ui/Toast";
import { useStudyLanguages } from "@/components/providers/StudyLanguageProvider";
import { languageDisplayName } from "@/lib/studyLanguages";
import { ValidationBanner } from "@/components/review/ValidationBanner";
import { validateCardEntry, type InvalidCard } from "@/lib/cardValidation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Entry } from "@/types";

export default function PreviewPage() {
    const router = useRouter();
    const { languages } = useStudyLanguages();

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

    const handleDeckClear = useCallback(() => {
        setSelectedDeckId("");
        setEntry((prev) => ({ ...prev, anki_deck: "" }));
    }, [setEntry]);

    const { confirmOpen, setConfirmOpen, isExporting, handleConfirm } = useAnkiExport({
        entry,
        selectedCardTypeIds,
        cardTypes,
    });

    const ankiConnected = useAnkiConnection();
    const [isSaving, setIsSaving] = useState(false);
    const [invalid, setInvalid] = useState<InvalidCard[]>([]);
    const media = useCardMedia(entry, setEntry, !isLoading && !error);
    const toast = useToast();

    const handleSaveOnly = useCallback(async () => {
        const errors = validateCardEntry(entry, selectedCardTypeIds);
        if (errors.length > 0) {
            setInvalid([{ index: 0, errors }]);
            return;
        }
        setInvalid([]);
        setIsSaving(true);
        try {
            const selectedTypes = cardTypes.filter(ct => selectedCardTypeIds.includes(ct.id));
            const result = await saveEntryToFirestore(entry, selectedTypes);
            if (result.ok) {
                toast.success('Card saved. Sync to Anki later.');
                router.push('/create?saved=1&count=1');
            } else {
                toast.error(result.error || 'Save failed');
            }
        } finally {
            setIsSaving(false);
        }
    }, [entry, selectedCardTypeIds, cardTypes, toast, router]);

    // 確認 modal を開く前に validate — 必須 field 不足 / 画像サイズ超過なら阻止。
    const requestConfirm = useCallback(() => {
        const errors = validateCardEntry(entry, selectedCardTypeIds);
        if (errors.length > 0) {
            setInvalid([{ index: 0, errors }]);
            return;
        }
        setInvalid([]);
        setConfirmOpen(true);
    }, [entry, selectedCardTypeIds, setConfirmOpen]);

    // Keyboard shortcut: Cmd+Enter / Ctrl+Enter to open confirm modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                if (!isExporting) requestConfirm();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isExporting, requestConfirm]);

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
        <MotionPage>
            <FlashcardReviewLayout
                headerLabel="Review Generation"
                headerActions={
                    <>
                        <Button variant="secondary" onClick={() => router.push("/create")} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                            Back
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleSaveOnly}
                            disabled={isSaving || isExporting}
                            leftIcon={<Save className="w-4 h-4" />}
                        >
                            {isSaving ? "Saving..." : "Save"}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={requestConfirm}
                            disabled={isExporting || isSaving || !ankiConnected}
                            leftIcon={<CheckCheck className="w-4 h-4" />}
                            title={ankiConnected ? undefined : "Anki is not connected"}
                        >
                            {isExporting ? "Exporting..." : "Save & Export"}
                            {!isExporting && (
                                <kbd className="ml-1.5 text-[10px] opacity-60 font-mono">&#8984;&#9166;</kbd>
                            )}
                        </Button>
                    </>
                }
                banner={
                    invalid.length > 0 ? (
                        <ValidationBanner invalid={invalid} onJump={() => {}} onDismiss={() => setInvalid([])} singleCard />
                    ) : null
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
                audioSubtitle={entry.language ? `Google TTS · ${languageDisplayName(entry.language, languages)}` : undefined}
                selectedDeckId={selectedDeckId}
                onDeckChange={handleDeckChange}
                onDeckClear={handleDeckClear}
                cardTypes={cardTypes}
                selectedCardTypeIds={selectedCardTypeIds}
                onCardTypesChange={setSelectedCardTypeIds}
            />

            {/* Confirm Modal */}
            <Modal
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                title="Save & Export to Anki"
                description={`Save "${wordLabel}" and export ${selectedCardTypeIds.length} card type(s) to Anki?`}
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
        </MotionPage>
    );
}
