"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PenLine, SlidersHorizontal } from "lucide-react";
import { Input, Textarea, Select, FieldWrapper } from "@/components/ui/FormField";
import { TagInput } from "@/components/ui/TagInput";
import { LanguageSelector } from "./LanguageSelector";
import { CategorySelector } from "./CategorySelector";
import { CardTypeSelector } from "./CardTypeSelector";
import { DeckSelector } from "./DeckSelector";
import { TopicSelector } from "./TopicSelector";
import { ColumnLabel } from "./ColumnLabel";
import { InfoCallout } from "./InfoCallout";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { DuplicateModal } from "./DuplicateModal";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/components/ui/Toast";
import { useDuplicateCheck } from "@/hooks/useDuplicateCheck";
import { FormType, LanguageType } from "@/types";
import { savePendingEntry } from "@/lib/pendingEntry";
import { verifyAttrs } from "@/verify/core/contract";
import type { CardFormBlueprint, CoreField, ConfigBlock, ConfigLeaf } from "@/lib/create/formBlueprint";

type StepStatus = "completed" | "active" | "pending";
type UIFormType = "Language" | "IT" | "General";

interface CardFormProps {
    blueprint: CardFormBlueprint;
    onGenerateStart?: () => void;
    onStepUpdate?: (stepIndex: number, status: StepStatus) => void;
    onGenerateEnd?: () => void;
    onValidityChange?: (canSubmit: boolean) => void;
    formId?: string;
}

export function CardForm({
    blueprint,
    onGenerateStart,
    onStepUpdate,
    onGenerateEnd,
    onValidityChange,
    formId,
}: CardFormProps) {
    const router = useRouter();
    const toast = useToast();
    const { session, updateSession, resetContent, isLoaded } = useSession(blueprint.formType);

    const [values, setValues] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const { duplicates, showWarning, setShowWarning, checkDuplicate } = useDuplicateCheck();
    const skipDuplicateCheck = useRef(false);

    const setValue = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

    const isLanguageFlow = blueprint.uiFormType === "Language";
    const language = (session?.language as LanguageType) || LanguageType.ENGLISH;
    const metaLanguage: LanguageType | null = isLanguageFlow ? language : null;
    const deckId = session?.deckId || "";
    const category = session?.categoryId || "";
    const tags = session?.tags || [];
    const cardTypes = session?.cardTypeIds || [];
    const topicIds = session?.topicIds || [];
    const difficulty = session?.difficulty || "intermediate";

    const primaryKey = blueprint.coreFields[0]?.key ?? "";
    const primaryValue = values[primaryKey] || "";

    useEffect(() => {
        onValidityChange?.(primaryValue.trim().length > 0);
    }, [primaryValue, onValidityChange]);

    const runGenerate = async () => {
        setError(null);
        onGenerateStart?.();

        try {
            onStepUpdate?.(0, "active");
            const effectiveSession = { ...(session ?? {}), language: metaLanguage ?? session?.language };

            let generatedContent: Record<string, unknown>;
            if (blueprint.generate.mode === "api") {
                const res = await fetch("/api/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(blueprint.generate.payload(values, effectiveSession)),
                });
                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || "Failed to call Claude API");
                }
                generatedContent = (await res.json()).content;
                onStepUpdate?.(0, "completed");
                onStepUpdate?.(1, "active");
                await new Promise((r) => setTimeout(r, 500));
                onStepUpdate?.(1, "completed");
                onStepUpdate?.(2, "active");
                await new Promise((r) => setTimeout(r, 400));
                onStepUpdate?.(2, "completed");
            } else {
                await new Promise((r) => setTimeout(r, 300));
                onStepUpdate?.(0, "completed");
                onStepUpdate?.(1, "active");
                await new Promise((r) => setTimeout(r, 200));
                onStepUpdate?.(1, "completed");
                onStepUpdate?.(2, "active");
                await new Promise((r) => setTimeout(r, 200));
                onStepUpdate?.(2, "completed");
                generatedContent = blueprint.generate.content(values, effectiveSession);
            }

            savePendingEntry({
                generatedContent,
                formType: blueprint.formType,
                language: metaLanguage,
                deckId,
                categoryId: category,
                cardTypeIds: cardTypes,
                tags,
                savedAt: new Date().toISOString(),
            });

            resetContent();
            setValues({});
            router.push("/preview");
        } catch (err) {
            console.error("Generate error:", err);
            const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
            setError(msg);
            toast.error(`Tạo nội dung thất bại: ${msg}`);
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
        const hasDuplicate = await checkDuplicate(primaryValue, metaLanguage ?? undefined);
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

    const renderCoreField = (field: CoreField, index: number) => {
        const isPrimary = index === 0;
        const value = values[field.key] || "";
        const onChange = (v: string) => setValue(field.key, v);

        let control: React.ReactNode;
        if (isPrimary || field.type === "text") {
            control = isPrimary ? (
                <input
                    type="text"
                    aria-label={field.label}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full h-[46px] bg-[#fcfcfb] border border-[#e3e3de] rounded-[10px] px-[14px] text-[15px] font-semibold text-ink placeholder:text-slate-400/70 placeholder:font-normal focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-bg transition-shadow"
                />
            ) : (
                <Input aria-label={field.label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
            );
        } else if (field.type === "textarea") {
            control = (
                <Textarea
                    aria-label={field.label}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    rows={4}
                    placeholder={field.placeholder}
                    className="rounded-[10px]"
                />
            );
        } else if (field.type === "dropdown") {
            control = (
                <Select aria-label={field.label} value={value} onChange={(e) => onChange(e.target.value)}>
                    <option value="">Select…</option>
                    {(field.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </Select>
            );
        } else {
            control = (
                <Input type="number" aria-label={field.label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
            );
        }

        return (
            <div key={field.key} className={index < blueprint.coreFields.length - 1 ? "mb-[22px]" : undefined}>
                <label className="block text-[13px] font-bold text-ink mb-2">
                    {field.label}{" "}
                    {isPrimary ? (
                        <span className="text-danger">*</span>
                    ) : field.optional ? (
                        <span className="font-medium text-slate-400">optional</span>
                    ) : null}
                </label>
                {control}
                {field.hint && <p className="text-[12px] text-slate-400 mt-1.5">{field.hint}</p>}
            </div>
        );
    };

    const renderLeaf = (leaf: ConfigLeaf): React.ReactNode => {
        switch (leaf.kind) {
            case "language":
                return <LanguageSelector value={language} onChange={(v) => updateSession({ language: v, deckId: "" })} />;
            case "deck":
                return (
                    <DeckSelector
                        value={deckId}
                        onChangeId={(id) => updateSession({ deckId: id })}
                        filterFormType={leaf.filterByLanguage ? FormType.LANGUAGE : undefined}
                        filterLanguage={leaf.filterByLanguage ? language : undefined}
                    />
                );
            case "category":
                return (
                    <CategorySelector
                        formType={(blueprint.uiFormType ?? "") as UIFormType | ""}
                        value={category}
                        onChange={(v) => updateSession({ categoryId: v })}
                    />
                );
            case "tags":
                return (
                    <FieldWrapper label="Tags">
                        <TagInput tags={tags} onChange={(v) => updateSession({ tags: v })} />
                    </FieldWrapper>
                );
            case "cardTypes":
                return (
                    <CardTypeSelector
                        formType={(blueprint.uiFormType ?? "Language") as UIFormType}
                        language={language}
                        selectedIds={cardTypes}
                        onChange={(v) => updateSession({ cardTypeIds: v })}
                    />
                );
            case "topic":
                return <TopicSelector selectedIds={topicIds} onChange={(v) => updateSession({ topicIds: v })} />;
            case "difficulty":
                return (
                    <FieldWrapper label="Difficulty">
                        <Select aria-label="Difficulty" value={difficulty} onChange={(e) => updateSession({ difficulty: e.target.value })}>
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                        </Select>
                    </FieldWrapper>
                );
            case "keywords":
                return (
                    <FieldWrapper label="Keywords">
                        <Input value={values.keywords || ""} onChange={(e) => setValue("keywords", e.target.value)} placeholder="async, callback, event…" />
                    </FieldWrapper>
                );
            default:
                return null;
        }
    };

    const renderBlock = (block: ConfigBlock, i: number): React.ReactNode => {
        if (block.kind === "row") {
            return (
                <div key={`row-${i}`} className="grid grid-cols-2 gap-3">
                    {block.blocks.map((leaf, j) => (
                        <div key={`${leaf.kind}-${j}`} className={leaf.span === 2 ? "col-span-2" : undefined}>
                            {renderLeaf(leaf)}
                        </div>
                    ))}
                </div>
            );
        }
        return <div key={`${block.kind}-${i}`}>{renderLeaf(block)}</div>;
    };

    return (
        <form
            id={formId}
            onSubmit={handleSubmit}
            className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start"
            {...verifyAttrs({ unit: "CardForm", formType: blueprint.formType, error: !!error })}
        >
            {/* Left — Core Content (focal) */}
            <div className="flex flex-col bg-white border border-border rounded-card p-6">
                <ColumnLabel label="Core content" icon={PenLine} tone="green" />
                {blueprint.coreFields.map(renderCoreField)}
                <ErrorMessage message={error} />
            </div>

            {/* Right — Configuration */}
            <div className="flex flex-col gap-5 bg-white border border-border rounded-card p-6">
                <ColumnLabel label="Configuration" icon={SlidersHorizontal} tone="amber" />
                {blueprint.configBlocks.map(renderBlock)}
                {blueprint.info && <InfoCallout>{blueprint.info}</InfoCallout>}
            </div>

            <DuplicateModal
                open={showWarning}
                onClose={() => setShowWarning(false)}
                onProceed={handleProceedAnyway}
                word={primaryValue}
                language={metaLanguage ?? undefined}
                duplicates={duplicates}
            />
        </form>
    );
}
