"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input, Textarea, FieldWrapper, Select } from "@/components/ui/FormField";
import { TagInput } from "@/components/ui/TagInput";
import { DeckSelector } from "./DeckSelector";
import { ColumnLabel } from "./ColumnLabel";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/hooks/useSession";
import { useDuplicateCheck } from "@/hooks/useDuplicateCheck";
import { savePendingEntry } from "@/lib/pendingEntry";
import { verifyAttrs } from "@/verify/core/contract";
import type { ContentType, FormFieldConfig } from "@/types";

type StepStatus = "completed" | "active" | "pending";

interface DynamicFormProps {
    contentType: ContentType;
    onGenerateStart?: () => void;
    onStepUpdate?: (stepIndex: number, status: StepStatus) => void;
    onGenerateEnd?: () => void;
    onValidityChange?: (canSubmit: boolean) => void;
    formId?: string;
}

export function DynamicForm({
    contentType,
    onGenerateStart,
    onStepUpdate,
    onGenerateEnd,
    onValidityChange,
    formId,
}: DynamicFormProps) {
    const router = useRouter();
    const { session, updateSession, resetContent, isLoaded } = useSession(
        contentType.code,
    );

    const sortedFields = [...contentType.fields].sort(
        (a, b) => a.sort_order - b.sort_order,
    );
    const primaryField = sortedFields[0];
    const otherFields = sortedFields.slice(1);

    const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const { duplicates, showWarning, setShowWarning, checkDuplicate } =
        useDuplicateCheck();
    const skipDuplicateCheck = useRef(false);

    const deckId = session?.deckId || "";
    const tags = session?.tags || [];

    const primaryValue = primaryField ? fieldValues[primaryField.field_key] || "" : "";

    useEffect(() => {
        onValidityChange?.(primaryValue.trim().length > 0);
    }, [primaryValue, onValidityChange]);

    const updateField = (key: string, value: string) => {
        setFieldValues((prev) => ({ ...prev, [key]: value }));
    };

    const runGenerate = async () => {
        setError(null);
        onGenerateStart?.();

        try {
            onStepUpdate?.(0, "active");

            const generateRes = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    word: primaryValue,
                    form_type: contentType.code,
                    contentTypeName: contentType.name,
                    dynamicFields: fieldValues,
                }),
            });

            if (!generateRes.ok) {
                const errData = await generateRes.json();
                throw new Error(errData.error || "Failed to call Claude API");
            }

            const { content: generatedContent } = await generateRes.json();
            onStepUpdate?.(0, "completed");

            onStepUpdate?.(1, "active");
            await new Promise((r) => setTimeout(r, 400));
            onStepUpdate?.(1, "completed");

            onStepUpdate?.(2, "active");
            await new Promise((r) => setTimeout(r, 300));
            onStepUpdate?.(2, "completed");

            savePendingEntry({
                generatedContent,
                formType: contentType.code,
                language: null,
                deckId,
                cardTypeIds: [],
                tags,
                savedAt: new Date().toISOString(),
            });

            resetContent();
            setFieldValues({});
            router.push("/preview");
        } catch (err) {
            console.error("Dynamic form generate error:", err);
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
        const hasDuplicate = await checkDuplicate(primaryValue);
        if (!hasDuplicate) {
            await runGenerate();
        }
    };

    const handleProceedAnyway = () => {
        setShowWarning(false);
        skipDuplicateCheck.current = true;
        const form = document.getElementById(formId || "") as HTMLFormElement | null;
        form?.requestSubmit();
    };

    if (!isLoaded) return null;

    const renderField = (field: FormFieldConfig, isPrimary = false) => {
        const value = fieldValues[field.field_key] || "";
        const key = field.field_key;

        if (isPrimary) {
            return (
                <div className="mb-5" key={key}>
                    <label className="text-overline uppercase text-slate-600 tracking-wider font-bold block mb-2">
                        {field.label}
                    </label>
                    <input
                        type="text"
                        aria-label={field.label}
                        value={value}
                        onChange={(e) => updateField(key, e.target.value)}
                        placeholder={field.placeholder || undefined}
                        className="w-full bg-surface hover:bg-canvas transition-colors border border-transparent rounded-lg px-5 py-4 text-xl font-bold text-ink placeholder:text-slate-600/40 placeholder:font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-bg appearance-none shadow-none"
                    />
                </div>
            );
        }

        switch (field.type) {
            case "textarea":
                return (
                    <FieldWrapper key={key} label={field.label}>
                        <Textarea
                            aria-label={field.label}
                            value={value}
                            onChange={(e) => updateField(key, e.target.value)}
                            rows={3}
                            placeholder={field.placeholder || undefined}
                            className="bg-surface hover:bg-canvas transition-colors px-5 py-4 text-sm"
                        />
                    </FieldWrapper>
                );
            case "dropdown":
                return (
                    <FieldWrapper key={key} label={field.label}>
                        <Select
                            aria-label={field.label}
                            value={value}
                            onChange={(e) => updateField(key, e.target.value)}
                        >
                            <option value="">Select...</option>
                        </Select>
                    </FieldWrapper>
                );
            case "number":
                return (
                    <FieldWrapper key={key} label={field.label}>
                        <Input
                            type="number"
                            aria-label={field.label}
                            value={value}
                            onChange={(e) => updateField(key, e.target.value)}
                            placeholder={field.placeholder || undefined}
                        />
                    </FieldWrapper>
                );
            default:
                return (
                    <FieldWrapper key={key} label={field.label}>
                        <Input
                            aria-label={field.label}
                            value={value}
                            onChange={(e) => updateField(key, e.target.value)}
                            placeholder={field.placeholder || undefined}
                        />
                    </FieldWrapper>
                );
        }
    };

    return (
        <form
            id={formId}
            onSubmit={handleSubmit}
            className="grid lg:grid-cols-12 gap-6"
            {...verifyAttrs({
                unit: "DynamicForm",
                error: !!error,
                contentType: contentType.code,
            })}
        >
            {/* Left — Core Content */}
            <div className="lg:col-span-7 flex flex-col bg-white rounded-card p-6 lg:p-8">
                <ColumnLabel label="Core Content" />
                {primaryField && renderField(primaryField, true)}
                <div className="flex flex-col gap-4">
                    {otherFields.map((f) => renderField(f))}
                </div>
                <ErrorMessage message={error} />
            </div>

            {/* Right — Configuration */}
            <div className="lg:col-span-5 flex flex-col bg-white rounded-card p-6 lg:p-8">
                <ColumnLabel label="Configuration" />
                <div className="flex flex-col gap-4">
                    <DeckSelector
                        value={deckId}
                        onChangeId={(id) => updateSession({ deckId: id })}
                    />
                    <FieldWrapper label="Tags">
                        <TagInput
                            tags={tags}
                            onChange={(v) => updateSession({ tags: v })}
                        />
                    </FieldWrapper>
                </div>
            </div>

            <Modal
                open={showWarning}
                onClose={() => setShowWarning(false)}
                title="Duplicate Found"
                description={`"${primaryValue}" already exists.`}
            >
                <div className="mt-2 space-y-2">
                    {duplicates.map((d) => (
                        <div
                            key={d.id}
                            className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 text-sm"
                        >
                            <span className="font-semibold text-ink">
                                {d.word}
                            </span>
                            <span className="text-slate-600">{d.anki_deck}</span>
                        </div>
                    ))}
                </div>
                <div className="flex gap-3 justify-end mt-4">
                    <Button variant="ghost" onClick={() => setShowWarning(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleProceedAnyway}>
                        Generate Anyway
                    </Button>
                </div>
            </Modal>
        </form>
    );
}
