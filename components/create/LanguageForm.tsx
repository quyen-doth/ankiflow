"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Textarea, FieldWrapper } from "@/components/ui/FormField";
import { TagInput } from "@/components/ui/TagInput";
import { LanguageSelector } from "./LanguageSelector";
import { CategorySelector } from "./CategorySelector";
import { CardTypeSelector } from "./CardTypeSelector";
import { DeckSelector } from "./DeckSelector";
import { SmartEnrichmentBanner } from "./SmartEnrichmentBanner";
import { ColumnLabel } from "./ColumnLabel";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/hooks/useSession";
import { useDuplicateCheck } from "@/hooks/useDuplicateCheck";
import { FormType, LanguageType } from "@/types";
import { savePendingEntry } from "@/lib/pendingEntry";
import { verifyAttrs } from "@/verify/core/contract";

type StepStatus = "completed" | "active" | "pending";

interface LanguageFormProps {
    onGenerateStart?: () => void;
    onStepUpdate?: (stepIndex: number, status: StepStatus) => void;
    onGenerateEnd?: () => void;
    onValidityChange?: (canSubmit: boolean) => void;
    formId?: string;
}

export function LanguageForm({
    onGenerateStart,
    onStepUpdate,
    onGenerateEnd,
    onValidityChange,
    formId,
}: LanguageFormProps) {
    const router = useRouter();
    const { session, updateSession, resetContent, isLoaded } = useSession(
        FormType.LANGUAGE,
    );

    const [vocabulary, setVocabulary] = useState("");
    const [notes, setNotes] = useState("");
    const [error, setError] = useState<string | null>(null);
    const { duplicates, showWarning, setShowWarning, checkDuplicate } = useDuplicateCheck();
    const skipDuplicateCheck = useRef(false);

    const language =
        (session?.language as LanguageType) || LanguageType.ENGLISH;
    const deckId = session?.deckId || "";
    const category = session?.categoryId || "";
    const tags = session?.tags || [];
    const cardTypes = session?.cardTypeIds || [];

    useEffect(() => {
        onValidityChange?.(vocabulary.trim().length > 0);
    }, [vocabulary, onValidityChange]);

    const runGenerate = async () => {
        setError(null);
        onGenerateStart?.();

        try {
            onStepUpdate?.(0, "active");

            const generateRes = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    word: vocabulary,
                    form_type: FormType.LANGUAGE,
                    language,
                    note: notes || undefined,
                }),
            });

            if (!generateRes.ok) {
                const errData = await generateRes.json();
                throw new Error(errData.error || "Failed to call Claude API");
            }

            const { content: generatedContent } = await generateRes.json();
            onStepUpdate?.(0, "completed");

            onStepUpdate?.(1, "active");
            await new Promise((r) => setTimeout(r, 500));
            onStepUpdate?.(1, "completed");

            onStepUpdate?.(2, "active");
            await new Promise((r) => setTimeout(r, 400));
            onStepUpdate?.(2, "completed");

            savePendingEntry({
                generatedContent,
                formType: FormType.LANGUAGE,
                language,
                deckId,
                categoryId: category,
                cardTypeIds: cardTypes,
                tags,
                savedAt: new Date().toISOString(),
            });

            resetContent();
            setVocabulary("");
            setNotes("");
            router.push("/preview");
        } catch (err) {
            console.error("Generate error:", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong. Please try again.",
            );
            onGenerateEnd?.();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (skipDuplicateCheck.current) {
            skipDuplicateCheck.current = false;
            await runGenerate();
            return;
        }
        const hasDuplicate = await checkDuplicate(vocabulary, language);
        if (!hasDuplicate) {
            await runGenerate();
        }
    };

    const handleProceedAnyway = () => {
        setShowWarning(false);
        skipDuplicateCheck.current = true;
        const form = document.getElementById(formId || '') as HTMLFormElement | null;
        form?.requestSubmit();
    };

    if (!isLoaded) return null;

    return (
        <form
            id={formId}
            onSubmit={handleSubmit}
            className="grid lg:grid-cols-12 gap-6"
            {...verifyAttrs({ unit: "LanguageForm", error: !!error, language })}
        >
            {/* Left — Core Content (focal) */}
            <div className="lg:col-span-7 flex flex-col bg-white rounded-card p-6 lg:p-8">
                <ColumnLabel label="Core Content" />

                <div className="mb-5">
                    <label className="text-overline uppercase text-slate-600 tracking-wider font-bold block mb-2">
                        Vocabulary Item
                    </label>
                    <input
                        type="text"
                        aria-label="Vocabulary Item"
                        value={vocabulary}
                        onChange={(e) => setVocabulary(e.target.value)}
                        className="w-full bg-surface hover:bg-canvas transition-colors border border-transparent rounded-lg px-5 py-4 text-xl font-bold text-ink placeholder:text-slate-600/40 placeholder:font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-bg appearance-none shadow-none"
                    />
                </div>

                <div className="mb-5">
                    <label className="text-overline uppercase text-slate-600 tracking-wider font-bold block mb-2">
                        Contextual Note
                    </label>
                    <Textarea
                        aria-label="Contextual Note"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="bg-surface hover:bg-canvas transition-colors px-5 py-4 text-sm"
                    />
                </div>

                <ErrorMessage message={error} />
            </div>

            {/* Right — Configuration */}
            <div className="lg:col-span-5 flex flex-col bg-white rounded-card p-6 lg:p-8">
                <ColumnLabel label="Configuration" />

                <div className="grid grid-cols-2 gap-3 mb-4">
                    <LanguageSelector
                        value={language}
                        onChange={(v) => updateSession({ language: v, deckId: '' })}
                    />
                    <DeckSelector
                        value={deckId}
                        onChangeId={(id) => updateSession({ deckId: id })}
                        filterFormType={FormType.LANGUAGE}
                        filterLanguage={language}
                    />
                    <div className="col-span-2">
                        <CategorySelector
                            formType="Language"
                            value={category}
                            onChange={(v) => updateSession({ categoryId: v })}
                        />
                    </div>
                </div>

                <div className="mb-6">
                    <FieldWrapper label="Tags">
                        <TagInput
                            tags={tags}
                            onChange={(v) => updateSession({ tags: v })}
                        />
                    </FieldWrapper>
                </div>

                <div className="flex-1 overflow-y-auto pr-1">
                    <CardTypeSelector
                        formType="Language"
                        language={language}
                        selectedIds={cardTypes}
                        onChange={(v) => updateSession({ cardTypeIds: v })}
                    />
                </div>
            </div>

            <Modal
                open={showWarning}
                onClose={() => setShowWarning(false)}
                title="Duplicate Found"
                description={`"${vocabulary}" already exists with the same language.`}
            >
                <div className="mt-2 space-y-2">
                    {duplicates.map(d => (
                        <div key={d.id} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 text-sm">
                            <span className="font-semibold text-ink">{d.word}</span>
                            <span className="text-slate-600">{d.anki_deck}</span>
                        </div>
                    ))}
                </div>
                <div className="flex gap-3 justify-end mt-4">
                    <Button variant="ghost" onClick={() => setShowWarning(false)}>Cancel</Button>
                    <Button variant="primary" onClick={handleProceedAnyway}>Generate Anyway</Button>
                </div>
            </Modal>
        </form>
    );
}
