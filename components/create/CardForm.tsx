"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PenLine, SlidersHorizontal } from "lucide-react";
import { Input, Textarea, Select, FieldWrapper } from "@/components/ui/FormField";
import { TagInput } from "@/components/ui/TagInput";
import { LanguageSelector } from "./LanguageSelector";
import { CategoryCreatableField } from "./CategoryCreatableField";
import { CardTypeSelector } from "./CardTypeSelector";
import { DeckCreatableField } from "./DeckCreatableField";
import { TopicSelector } from "./TopicSelector";
import { ColumnLabel } from "./ColumnLabel";
import { InfoCallout } from "./InfoCallout";
import { BatchItemList } from "./BatchItemList";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { DuplicateModal } from "./DuplicateModal";
import { BatchDuplicateModal } from "./BatchDuplicateModal";
import { DetectedLanguageModal } from "./DetectedLanguageModal";
import type { BatchDuplicateResult, DuplicateEntry } from "@/hooks/useDuplicateCheck";
import { useSession } from "@/hooks/useSession";
import { useStudyLanguages } from "@/components/providers/StudyLanguageProvider";
import { useToast } from "@/components/ui/Toast";
import { useDuplicateCheck } from "@/hooks/useDuplicateCheck";
import { FormType } from "@/types";
import { savePendingEntry } from "@/lib/pendingEntry";
import { savePendingBatch } from "@/lib/pendingBatch";
import { generateBatch } from "@/lib/create/batchGenerate";
import { detectItemLanguages, formatMixedLanguageError } from "@/lib/create/languageDetection";
import { detectByScript } from "@/lib/create/scriptDetection";
import { clearDraft, hasDraftContent, loadDraft, saveDraft } from "@/lib/create/draftCache";
import {
    canonicalizeLanguageCode,
    inferLanguageDisplayName,
    resolveStudyLanguage,
} from "@/lib/studyLanguages";
import { verifyAttrs } from "@/verify/core/contract";
import type { CardFormBlueprint, CoreField, ConfigBlock, ConfigLeaf } from "@/lib/create/formBlueprint";
import type { LanguageDetection } from "@/lib/ai-agent";
import type { LanguageCode, StudyLanguage } from "@/types";

type StepStatus = "completed" | "active" | "pending";
type UIFormType = "Language" | "IT" | "General";

interface PendingLanguageAction {
    detection: LanguageDetection;
    existingDisabled: boolean;
    batch: boolean;
    items: string[];
}

type PendingDuplicateCheck =
    | { batch: false; promise: Promise<DuplicateEntry[]> }
    | { batch: true; promise: Promise<BatchDuplicateResult[]> };

interface CardFormProps {
    blueprint: CardFormBlueprint;
    batchMode?: boolean;
    onGenerateStart?: () => void;
    onStepUpdate?: (stepIndex: number, status: StepStatus) => void;
    onGenerateEnd?: () => void;
    onValidityChange?: (canSubmit: boolean) => void;
    onBatchCountChange?: (count: number) => void;
    onBatchProgress?: (done: number, total: number) => void;
    registerCancel?: (cancel: () => void) => void;
    formId?: string;
}

export function CardForm({
    blueprint,
    batchMode = false,
    onGenerateStart,
    onStepUpdate,
    onGenerateEnd,
    onValidityChange,
    onBatchCountChange,
    onBatchProgress,
    registerCancel,
    formId,
}: CardFormProps) {
    const router = useRouter();
    const toast = useToast();
    const { session, updateSession, resetContent, isLoaded } = useSession(blueprint.formType);
    const {
        languages,
        enabledLanguages,
        aiOutputLanguage,
        loading: languagesLoading,
        addOrEnableLanguage,
    } = useStudyLanguages();

    const [values, setValues] = useState<Record<string, string>>({});
    const [batchItems, setBatchItems] = useState<string[]>([""]);
    const [error, setError] = useState<string | null>(null);
    const {
        duplicates,
        showWarning,
        setShowWarning,
        fetchDuplicates,
        presentDuplicates,
        checkDuplicatesBatch,
    } = useDuplicateCheck();
    const abortRef = useRef<AbortController | null>(null);
    const [batchDuplicates, setBatchDuplicates] = useState<BatchDuplicateResult[]>([]);
    const [showBatchDuplicate, setShowBatchDuplicate] = useState(false);
    const [detectingLanguage, setDetectingLanguage] = useState(false);
    const [pendingLanguageAction, setPendingLanguageAction] = useState<PendingLanguageAction | null>(null);
    const pendingDuplicateRef = useRef<PendingDuplicateCheck | null>(null);
    const [savingDetectedLanguage, setSavingDetectedLanguage] = useState(false);
    const activeSubmitLanguage = useRef<LanguageCode | null>(null);
    const languageConfigReset = useRef(false);
    // draft 復元前に auto-save が空の初期値で既存 draft を消さないようにする。
    const draftHydratedRef = useRef(false);

    // client component も初回は SSR されるため、hydration mismatch を避けて effect 内で復元する。
    // blueprint.formType は key={activeCode} による mount ごとに固定される。
    // NOTE: async wrapper は useSession と同じ意図的なパターン — 同期 setState を effect 直下に
    // 置くと react-hooks/set-state-in-effect (error) に違反するため。await が無くても削らないこと。
    useEffect(() => {
        async function hydrate() {
            const draft = loadDraft(blueprint.formType);
            if (draft) {
                // blueprint に現存する field のみ復元 — admin がフォーム定義を変更した後の
                // stale key が dynamicFields 経由で AI に渡るのを防ぐ。"keywords" は IT flow の
                // coreFields 外の固定入力 (下の renderLeaf 参照) のため明示的に許可する。
                const validKeys = new Set([...blueprint.coreFields.map((field) => field.key), "keywords"]);
                const restoredValues = Object.fromEntries(
                    Object.entries(draft.values).filter(([key]) => validKeys.has(key)),
                );
                // batchItems と同じ基準: 空白のみの内容は復元しない (すぐ auto-clear されるだけ)。
                if (Object.values(restoredValues).some((value) => value.trim().length > 0)) {
                    setValues(restoredValues);
                }
                if (draft.batchItems.some((item) => item.trim().length > 0)) setBatchItems(draft.batchItems);
            }
            draftHydratedRef.current = true;
        }
        void hydrate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 入力内容を debounce 保存し、すべて空になった場合は draft を削除する。
    useEffect(() => {
        if (!draftHydratedRef.current) return;
        const timer = setTimeout(() => {
            if (hasDraftContent(values, batchItems)) {
                saveDraft(blueprint.formType, { values, batchItems });
            } else {
                clearDraft(blueprint.formType);
            }
        }, 400);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [values, batchItems]);

    const setValue = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

    const isLanguageFlow = blueprint.uiFormType === "Language";
    const storedLanguage = session?.language || "";
    const language = enabledLanguages.some(item => item.code === storedLanguage) ? storedLanguage : "";
    const metaLanguage: LanguageCode | null = isLanguageFlow && language ? language : null;
    const deckId = session?.deckId || "";
    const category = session?.categoryId || "";
    const tags = session?.tags || [];
    const cardTypes = session?.cardTypeIds || [];
    const topicIds = session?.topicIds || [];
    const difficulty = session?.difficulty || "intermediate";

    const primaryKey = blueprint.coreFields[0]?.key ?? "";
    const primaryValue = values[primaryKey] || "";

    const batchValidItems = batchItems.map((it) => it.trim()).filter(Boolean);

    useEffect(() => {
        if (batchMode) {
            onValidityChange?.(batchValidItems.length > 0 && !detectingLanguage);
            onBatchCountChange?.(batchValidItems.length);
        } else {
            onValidityChange?.(primaryValue.trim().length > 0 && !detectingLanguage);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [primaryValue, batchMode, batchItems, detectingLanguage, onValidityChange, onBatchCountChange]);

    const languageNameFor = (code: LanguageCode | null): string | undefined => {
        if (!code) return undefined;
        return languages.find(item => canonicalizeLanguageCode(item.code) === canonicalizeLanguageCode(code))?.display_name;
    };

    const finishIfAborted = (controller = abortRef.current): boolean => {
        if (!controller?.signal.aborted) return false;
        setShowWarning(false);
        setShowBatchDuplicate(false);
        onGenerateEnd?.();
        return true;
    };

    const prepareResume = (duplicateCheckCompleted: boolean): void => {
        let controller = abortRef.current;
        if (!controller || controller.signal.aborted) {
            controller = new AbortController();
            abortRef.current = controller;
            const activeController = controller;
            registerCancel?.(() => activeController.abort());
        }
        onGenerateStart?.();
        onStepUpdate?.(0, "completed");
        onStepUpdate?.(1, duplicateCheckCompleted ? "completed" : "active");
    };

    const runGenerate = async (languageOverride?: LanguageCode | null) => {
        const submissionLanguage = isLanguageFlow ? (languageOverride ?? metaLanguage) : null;
        if (isLanguageFlow && !submissionLanguage) {
            setError("Select a study language before generating the card.");
            onGenerateEnd?.();
            return;
        }
        setError(null);
        const controller = abortRef.current;
        if (!controller || finishIfAborted(controller)) return;

        try {
            onStepUpdate?.(2, "active");
            const effectiveSession = {
                ...(session ?? {}),
                language: submissionLanguage ?? session?.language,
                languageName: languageNameFor(submissionLanguage),
                outputLanguage: aiOutputLanguage,
                outputLanguageName: inferLanguageDisplayName(aiOutputLanguage),
            };

            let generatedContent: Record<string, unknown>;
            if (blueprint.generate.mode === "api") {
                const res = await fetch("/api/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(blueprint.generate.payload(values, effectiveSession)),
                    signal: controller.signal,
                });
                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || "Failed to call Claude API");
                }
                generatedContent = (await res.json()).content;
                onStepUpdate?.(2, "completed");
            } else {
                onStepUpdate?.(0, "completed");
                onStepUpdate?.(1, "completed");
                onStepUpdate?.(2, "active");
                generatedContent = blueprint.generate.content(values, effectiveSession);
                onStepUpdate?.(2, "completed");
            }

            if (finishIfAborted(controller)) return;

            savePendingEntry({
                generatedContent,
                formType: blueprint.formType,
                language: submissionLanguage,
                outputLanguage: aiOutputLanguage,
                deckId: languageConfigReset.current ? "" : deckId,
                categoryId: category,
                cardTypeIds: languageConfigReset.current ? [] : cardTypes,
                tags,
                savedAt: new Date().toISOString(),
            });

            resetContent();
            clearDraft(blueprint.formType);
            setValues({});
            router.push("/preview");
        } catch (err) {
            // Người dùng hủy giữa chừng → giữ nguyên dữ liệu để chỉnh sửa, không báo lỗi.
            if (controller.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
                setError(null);
                toast.info("Card generation cancelled");
                onGenerateEnd?.();
                return;
            }
            console.error("Generate error:", err);
            const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
            setError(msg);
            toast.error(`Content generation failed: ${msg}`);
            onGenerateEnd?.();
        }
    };

    const runBatchGenerate = async (itemsOverride?: string[], languageOverride?: LanguageCode | null) => {
        setError(null);
        const items = itemsOverride ?? batchItems.map((it) => it.trim()).filter(Boolean);
        if (items.length === 0) {
            onGenerateEnd?.();
            return;
        }
        const submissionLanguage = isLanguageFlow ? (languageOverride ?? metaLanguage) : null;
        if (isLanguageFlow && !submissionLanguage) {
            setError("Select a study language before generating the batch.");
            onGenerateEnd?.();
            return;
        }

        const controller = abortRef.current;
        if (!controller || finishIfAborted(controller)) return;

        try {
            onStepUpdate?.(2, "active");
            const effectiveSession = {
                ...(session ?? {}),
                language: submissionLanguage ?? session?.language,
                languageName: languageNameFor(submissionLanguage),
                outputLanguage: aiOutputLanguage,
                outputLanguageName: inferLanguageDisplayName(aiOutputLanguage),
            };
            const results = await generateBatch(blueprint, items, effectiveSession, {
                onProgress: (done, total) => onBatchProgress?.(done, total),
                signal: controller.signal,
            });

            // Người dùng hủy giữa chừng → giữ nguyên danh sách item để chỉnh sửa.
            if (controller.signal.aborted) {
                toast.info("Card generation cancelled");
                onGenerateEnd?.();
                return;
            }
            onStepUpdate?.(2, "completed");

            const succeeded = results.filter((r) => r && r.ok && r.content);
            const failed = results.filter((r) => r && !r.ok);

            if (succeeded.length === 0) {
                throw new Error("Could not generate any cards. Please try again.");
            }
            if (failed.length > 0) {
                toast.warning(`Skipped ${failed.length} item(s): ${failed.map((f) => f.item).join(", ")}`);
            }

            savePendingBatch({
                items: succeeded.map((r) => r.content as Record<string, unknown>),
                formType: blueprint.formType,
                language: submissionLanguage,
                outputLanguage: aiOutputLanguage,
                deckId: languageConfigReset.current ? "" : deckId,
                categoryId: category,
                cardTypeIds: languageConfigReset.current ? [] : cardTypes,
                tags,
                savedAt: new Date().toISOString(),
            });

            resetContent();
            clearDraft(blueprint.formType);
            setBatchItems([""]);
            router.push("/preview/batch");
        } catch (err) {
            if (controller.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
                toast.info("Card generation cancelled");
                onGenerateEnd?.();
                return;
            }
            console.error("Batch generate error:", err);
            const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
            setError(msg);
            toast.error(`Batch generation failed: ${msg}`);
            onGenerateEnd?.();
        }
    };

    const applyDetectedLanguage = (selected: StudyLanguage): LanguageCode => {
        const previous = canonicalizeLanguageCode(storedLanguage);
        const next = canonicalizeLanguageCode(selected.code) ?? selected.code;
        const changed = previous !== next;
        activeSubmitLanguage.current = next;
        languageConfigReset.current = changed;
        updateSession(changed
            ? { language: next, deckId: "", cardTypeIds: [] }
            : { language: next });
        if (changed) {
            toast.info(`${storedLanguage ? "Language changed" : "Language detected"}: ${selected.display_name}`);
        }
        return next;
    };

    const continueSingle = async (
        submissionLanguage: LanguageCode | null,
        prefetched?: Promise<DuplicateEntry[]>,
    ) => {
        activeSubmitLanguage.current = submissionLanguage;
        onStepUpdate?.(1, "active");
        const found = await (prefetched ?? fetchDuplicates(primaryValue, abortRef.current?.signal));
        if (finishIfAborted()) return;
        onStepUpdate?.(1, "completed");
        if (found.length > 0) {
            onGenerateEnd?.();
            presentDuplicates(found);
            return;
        }
        await runGenerate(submissionLanguage);
    };

    const continueBatch = async (
        items: string[],
        submissionLanguage: LanguageCode | null,
        prefetched?: Promise<BatchDuplicateResult[]>,
    ) => {
        activeSubmitLanguage.current = submissionLanguage;
        onStepUpdate?.(1, "active");
        const results = await (prefetched ?? checkDuplicatesBatch(items, abortRef.current?.signal));
        if (finishIfAborted()) return;
        onStepUpdate?.(1, "completed");
        const duplicatesFound = results.filter((result) => result.duplicates.length > 0);
        if (duplicatesFound.length > 0) {
            setBatchDuplicates(duplicatesFound);
            setShowBatchDuplicate(true);
            onGenerateEnd?.();
            return;
        }
        await runBatchGenerate(items, submissionLanguage);
    };

    const detectAndContinue = async (items: string[], batch: boolean) => {
        setError(null);
        setDetectingLanguage(true);
        const controller = abortRef.current;
        if (!controller || finishIfAborted(controller)) {
            setDetectingLanguage(false);
            return;
        }
        // 重複チェックは言語判定結果に依存しないため、同時に開始する。
        const singleDuplicatePromise = batch
            ? null
            : fetchDuplicates(items[0], controller.signal);
        const batchDuplicatePromise = batch
            ? checkDuplicatesBatch(items, controller.signal)
            : null;
        try {
            const candidates = languages.map(item => ({ code: item.code, display_name: item.display_name }));
            const detections = detectByScript(items, candidates)
                ?? await detectItemLanguages(items, candidates, controller.signal);
            if (finishIfAborted(controller)) return;
            onStepUpdate?.(0, "completed");
            onStepUpdate?.(1, "active");
            const allConfigured = languages.map(item => ({ ...item, enabled: true }));
            const resolvedDetections = detections.map(detection => {
                const configured = resolveStudyLanguage(detection.code, allConfigured, storedLanguage);
                return configured
                    ? { ...detection, code: configured.code, display_name: configured.display_name }
                    : detection;
            });

            if (batch) {
                const mixedLanguageError = formatMixedLanguageError(items, resolvedDetections);
                if (mixedLanguageError) {
                    setError(mixedLanguageError);
                    onGenerateEnd?.();
                    return;
                }
            }

            const detection = resolvedDetections[0];
            const enabledMatch = resolveStudyLanguage(detection.code, languages, storedLanguage);
            if (enabledMatch) {
                const code = applyDetectedLanguage(enabledMatch);
                if (batch) await continueBatch(items, code, batchDuplicatePromise ?? undefined);
                else await continueSingle(code, singleDuplicatePromise ?? undefined);
                return;
            }

            const configuredMatch = resolveStudyLanguage(detection.code, allConfigured, storedLanguage);
            const originalConfiguredMatch = configuredMatch
                ? languages.find(item => (
                    canonicalizeLanguageCode(item.code) === canonicalizeLanguageCode(configuredMatch.code)
                ))
                : undefined;
            setPendingLanguageAction({
                detection: configuredMatch
                    ? { ...detection, code: configuredMatch.code, display_name: configuredMatch.display_name }
                    : detection,
                existingDisabled: !!originalConfiguredMatch && !originalConfiguredMatch.enabled,
                batch,
                items,
            });
            if (batch && batchDuplicatePromise) {
                pendingDuplicateRef.current = { batch: true, promise: batchDuplicatePromise };
            } else if (!batch && singleDuplicatePromise) {
                pendingDuplicateRef.current = { batch: false, promise: singleDuplicatePromise };
            }
            onGenerateEnd?.();
        } catch (detectionError) {
            // Người dùng hủy trong pha detect → không rơi xuống fallback ngôn ngữ đã chọn.
            if (controller.signal.aborted || (detectionError instanceof Error && detectionError.name === "AbortError")) {
                toast.info("Card generation cancelled");
                onGenerateEnd?.();
                return;
            }
            const selectedFallback = storedLanguage
                ? resolveStudyLanguage(storedLanguage, languages, storedLanguage)
                : null;
            if (selectedFallback) {
                toast.warning("Language detection failed. Using your manually selected language.");
                onStepUpdate?.(0, "completed");
                onStepUpdate?.(1, "active");
                const code = applyDetectedLanguage(selectedFallback);
                if (batch) await continueBatch(items, code, batchDuplicatePromise ?? undefined);
                else await continueSingle(code, singleDuplicatePromise ?? undefined);
            } else {
                const message = detectionError instanceof Error ? detectionError.message : "Unknown error";
                setError(`Language detection failed: ${message}. Select a language manually and try again.`);
                onGenerateEnd?.();
            }
        } finally {
            setDetectingLanguage(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (detectingLanguage) return;

        const items = batchMode ? batchValidItemsList() : [primaryValue.trim()].filter(Boolean);
        if (items.length === 0) return;

        const controller = new AbortController();
        abortRef.current = controller;
        registerCancel?.(() => controller.abort());
        onGenerateStart?.();

        if (!isLanguageFlow) {
            onStepUpdate?.(0, "completed");
            onStepUpdate?.(1, "active");
        }

        if (batchMode) {
            if (isLanguageFlow) await detectAndContinue(items, true);
            else await continueBatch(items, null);
            return;
        }
        if (isLanguageFlow) await detectAndContinue([primaryValue], false);
        else await continueSingle(null);
    };

    // Batch duplicate modal handlers
    const batchValidItemsList = () => batchItems.map((it) => it.trim()).filter(Boolean);
    const handleBatchProceedAll = () => {
        setShowBatchDuplicate(false);
        prepareResume(true);
        runBatchGenerate(batchValidItemsList(), activeSubmitLanguage.current);
    };
    const handleBatchSkipDuplicates = () => {
        setShowBatchDuplicate(false);
        const dupWords = new Set(batchDuplicates.map((d) => d.word));
        prepareResume(true);
        runBatchGenerate(
            batchValidItemsList().filter((it) => !dupWords.has(it)),
            activeSubmitLanguage.current,
        );
    };

    const handleProceedAnyway = () => {
        setShowWarning(false);
        prepareResume(true);
        runGenerate(activeSubmitLanguage.current);
    };

    const handleDetectedLanguageConfirm = async () => {
        if (!pendingLanguageAction) return;
        setSavingDetectedLanguage(true);
        try {
            const saved = await addOrEnableLanguage({
                code: pendingLanguageAction.detection.code,
                display_name: pendingLanguageAction.detection.display_name,
            });
            const action = pendingLanguageAction;
            const pendingDuplicate = pendingDuplicateRef.current;
            pendingDuplicateRef.current = null;
            setPendingLanguageAction(null);
            const code = applyDetectedLanguage(saved);
            prepareResume(false);
            if (action.batch) {
                const prefetched = pendingDuplicate?.batch ? pendingDuplicate.promise : undefined;
                await continueBatch(action.items, code, prefetched);
            } else {
                const prefetched = pendingDuplicate && !pendingDuplicate.batch
                    ? pendingDuplicate.promise
                    : undefined;
                await continueSingle(code, prefetched);
            }
        } catch (saveError) {
            const message = saveError instanceof Error ? saveError.message : "Unknown error";
            toast.error(`Failed to update study languages: ${message}`);
        } finally {
            setSavingDetectedLanguage(false);
        }
    };

    const handleDetectedLanguageClose = () => {
        pendingDuplicateRef.current = null;
        setPendingLanguageAction(null);
    };

    if (!isLoaded || languagesLoading) return null;

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
                    autoFocus
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
                return (
                    <LanguageSelector
                        value={language}
                        languages={languages}
                        onChange={(v) => updateSession({ language: v, deckId: "", cardTypeIds: [] })}
                        onClear={() => updateSession({ language: "", deckId: "", cardTypeIds: [] })}
                    />
                );
            case "deck":
                return (
                    <DeckCreatableField
                        value={deckId}
                        onChangeId={(id) => updateSession({ deckId: id })}
                        onClear={() => updateSession({ deckId: "" })}
                        filterFormType={leaf.filterByLanguage ? FormType.LANGUAGE : undefined}
                        filterLanguage={leaf.filterByLanguage ? (language || undefined) : undefined}
                        createFormType={blueprint.formType}
                        createLanguage={isLanguageFlow ? (language || undefined) : undefined}
                    />
                );
            case "category":
                return (
                    <CategoryCreatableField
                        formType={(blueprint.uiFormType ?? "") as UIFormType | ""}
                        value={category}
                        onChange={(v) => updateSession({ categoryId: v })}
                        onClear={() => updateSession({ categoryId: "" })}
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
                <div key={`row-${i}`} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {block.blocks.map((leaf, j) => (
                        <div key={`${leaf.kind}-${j}`} className={leaf.span === 2 ? "sm:col-span-2" : undefined}>
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
                <ColumnLabel label={batchMode ? "Core content — batch" : "Core content"} icon={PenLine} tone="green" />
                {batchMode ? (
                    <BatchItemList
                        items={batchItems}
                        onChange={setBatchItems}
                        label={blueprint.coreFields[0]?.label ?? "Item"}
                        placeholder={blueprint.coreFields[0]?.placeholder}
                        hint={blueprint.coreFields[0]?.hint}
                    />
                ) : (
                    blueprint.coreFields.map(renderCoreField)
                )}
                {detectingLanguage && (
                    <div className="flex items-center gap-3 mt-3">
                        <p className="text-[12.5px] text-primary" role="status">Detecting language…</p>
                        <button
                            type="button"
                            onClick={() => abortRef.current?.abort()}
                            className="text-[12.5px] text-slate-500 underline underline-offset-2 hover:text-ink"
                        >
                            Cancel
                        </button>
                    </div>
                )}
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

            <BatchDuplicateModal
                open={showBatchDuplicate}
                onClose={() => setShowBatchDuplicate(false)}
                onProceedAll={handleBatchProceedAll}
                onSkipDuplicates={handleBatchSkipDuplicates}
                duplicates={batchDuplicates}
                totalCount={batchValidItems.length}
            />

            <DetectedLanguageModal
                open={!!pendingLanguageAction}
                detection={pendingLanguageAction?.detection ?? null}
                existingDisabled={pendingLanguageAction?.existingDisabled ?? false}
                saving={savingDetectedLanguage}
                onConfirm={handleDetectedLanguageConfirm}
                onClose={handleDetectedLanguageClose}
            />
        </form>
    );
}
