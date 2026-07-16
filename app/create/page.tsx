'use client';

import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { CardForm } from '@/components/create/CardForm';
import { ModeToggle } from '@/components/create/ModeToggle';
import { MotionPage } from '@/components/ui/MotionPage';
import { getBlueprintForContentType } from '@/lib/create/formBlueprint';
import {
    prepareRuntimeContentTypes,
    resolveContentTypeFormType,
} from '@/lib/contentTypes';
import { loadUserContentTypes } from '@/lib/userContentTypes';
import { loadCreateUiState, saveCreateUiState } from '@/lib/create/draftCache';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { verifyAttrs } from '@/verify/core/contract';
import {
    Languages,
    Terminal,
    BookOpen,
    SlidersHorizontal,
    ArrowUpRight,
    PlusCircle,
} from 'lucide-react';
import { FormType } from '@/types';
import type { ContentType } from '@/types';
import type { UserContentTypeLoader } from '@/lib/userContentTypes';

const ICON_MAP: Record<string, React.ElementType> = {
    Languages,
    Terminal,
    BookOpen,
    SlidersHorizontal,
};

const BUILTIN_ICONS: Record<string, React.ElementType> = {
    [FormType.LANGUAGE]: Languages,
    [FormType.IT]: Terminal,
    [FormType.GENERAL]: BookOpen,
};

// ─── Step types cho Loading Overlay ─────────────────────────────────────────
type StepStatus = 'completed' | 'active' | 'pending';

interface LoadingStep {
    label: string;
    description?: string;
    status: StepStatus;
}

const INITIAL_STEPS: LoadingStep[] = [
    { label: 'Detecting language', status: 'active' },
    { label: 'Checking duplicates', status: 'pending' },
    { label: 'Calling Claude AI', status: 'pending' },
];

const FORM_ID = 'create-form';

function resolveIcon(contentType: ContentType): React.ElementType {
    const ft = resolveContentTypeFormType(contentType.code);
    if (ft && BUILTIN_ICONS[ft]) return BUILTIN_ICONS[ft];
    if (contentType.icon && ICON_MAP[contentType.icon]) return ICON_MAP[contentType.icon];
    return BookOpen;
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function CreatePage() {
    return (
        <Suspense>
            <CreateContent />
        </Suspense>
    );
}

interface CreateContentProps {
    loadContentTypes?: UserContentTypeLoader;
}

export function CreateContent({ loadContentTypes = loadUserContentTypes }: CreateContentProps = {}) {
    const { user, loading: authLoading } = useAuth();
    const uid = user?.uid;
    const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
    const [loadingTypes, setLoadingTypes] = useState(true);
    const [contentTypeError, setContentTypeError] = useState<string | null>(null);
    const [contentTypeWarning, setContentTypeWarning] = useState<string | null>(null);
    const [activeCode, setActiveCode] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>(INITIAL_STEPS);
    const [progress, setProgress] = useState(0);
    const [batchMode, setBatchMode] = useState(false);
    const [batchCount, setBatchCount] = useState(0);
    const [batchProgress, setBatchProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
    const cancelRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (authLoading || !uid) return;

        let cancelled = false;
        const currentUid = uid;

        async function fetchContentTypes() {
            try {
                setLoadingTypes(true);
                setContentTypeError(null);
                const prepared = prepareRuntimeContentTypes(await loadContentTypes(currentUid));
                if (cancelled) return;

                // 競合した Content Type だけ非表示にし、残りはそのまま作成に使える。
                setContentTypeWarning(
                    prepared.conflictingCodes.length > 0
                        ? `Some Content Types share a routing code and were hidden: ${prepared.conflictingCodes.join(', ')}. Fix them in Settings.`
                        : null,
                );

                const types = prepared.contentTypes;
                setContentTypes(types);
                if (types.length > 0) {
                    // 前回選択したタブ/モードを復元し、現在の types に無ければ先頭へ戻す。
                    const savedUi = loadCreateUiState();
                    const restored = savedUi ? types.find((type) => type.code === savedUi.activeCode) : undefined;
                    if (restored && savedUi) {
                        setActiveCode(restored.code);
                        setBatchMode(savedUi.batchMode);
                    } else {
                        setActiveCode(types[0].code);
                        setBatchMode(types[0].default_create_mode === 'batch');
                    }
                } else {
                    setActiveCode('');
                }
            } catch (error) {
                console.error('Error fetching content types:', error);
                if (!cancelled) {
                    setContentTypes([]);
                    setActiveCode('');
                    setContentTypeWarning(null);
                    setContentTypeError('Unable to load your Content Types. Please try again or review them in Settings.');
                }
            } finally {
                if (!cancelled) setLoadingTypes(false);
            }
        }
        void fetchContentTypes();

        return () => {
            cancelled = true;
        };
    }, [authLoading, loadContentTypes, uid]);

    const activeType = contentTypes.find((t) => t.code === activeCode);

    const handleStepUpdate = useCallback((stepIndex: number, status: StepStatus) => {
        setLoadingSteps((prev) => prev.map((s, i) => (i === stepIndex ? { ...s, status } : s)));
        const completedSteps = stepIndex + (status === 'completed' ? 1 : 0);
        setProgress(Math.round((completedSteps / INITIAL_STEPS.length) * 100));
    }, []);

    const handleGenerateStart = useCallback(() => {
        setIsGenerating(true);
        setLoadingSteps(INITIAL_STEPS);
        setProgress(0);
        setBatchProgress({ done: 0, total: 0 });
    }, []);

    const handleGenerateEnd = useCallback(() => {
        setIsGenerating(false);
    }, []);

    const handleSelectType = useCallback(
        (code: string) => {
            setActiveCode(code);
            // Đặt chế độ tạo mặc định (single/batch) theo content type đang chọn.
            const next = contentTypes.find((ct) => ct.code === code);
            setBatchMode(next?.default_create_mode === 'batch');
            setBatchCount(0);
            saveCreateUiState({ activeCode: code, batchMode: next?.default_create_mode === 'batch' });
        },
        [contentTypes],
    );

    const handleModeChange = useCallback(
        (batch: boolean) => {
            setBatchMode(batch);
            setBatchCount(0);
            saveCreateUiState({ activeCode, batchMode: batch });
        },
        [activeCode],
    );

    const handleBatchProgress = useCallback((done: number, total: number) => {
        setBatchProgress({ done, total });
    }, []);

    const handleCancelGenerate = useCallback(() => {
        cancelRef.current?.();
        setIsGenerating(false);
        setBatchProgress({ done: 0, total: 0 });
    }, []);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                if (isGenerating) return;
                const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
                form?.requestSubmit();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isGenerating]);

    const blueprintState = useMemo(() => {
        if (!activeType) return { blueprint: null, error: null };
        try {
            return { blueprint: getBlueprintForContentType(activeType), error: null };
        } catch (error) {
            return {
                blueprint: null,
                error: error instanceof Error
                    ? error.message
                    : 'Invalid Content Type field configuration.',
            };
        }
    }, [activeType]);
    const blueprint = blueprintState.blueprint;
    const runtimeContentTypeError = contentTypeError ?? blueprintState.error;

    return (
        <MotionPage>
            {/* Custom breadcrumb + title */}
            <div className="sticky top-16 md:top-0 z-10 -mx-4 md:-mx-8 md:-mt-8 mb-6 px-4 md:px-[34px] py-5 border-b border-[#eaeae6] bg-canvas/85 backdrop-blur-md">
                <nav className="flex items-center text-meta font-mono text-slate-400 mb-2">
                    <PlusCircle className="w-3.5 h-3.5 mr-2 text-slate-400" />
                    <span className="uppercase tracking-[0.05em] font-bold">Create Card</span>
                    <span className="mx-2.5 text-slate-400/50">/</span>
                    <span className="text-primary font-bold">{activeType?.name ?? 'Card'} Flow</span>
                </nav>
                <h1 className="text-page-title font-extrabold text-ink tracking-[-0.02em]">New flashcard</h1>
            </div>

            <div
                className="max-w-6xl mx-auto w-full pb-6 flex flex-col gap-6"
                {...verifyAttrs({
                    unit: 'CreateContentTypes',
                    loading: loadingTypes,
                    state: runtimeContentTypeError ? 'error' : contentTypes.length > 0 ? 'ready' : 'empty',
                    warning: !!contentTypeWarning,
                })}
            >
                {!loadingTypes && contentTypeWarning && (
                    <div className="rounded-[11px] border border-[#f0e4cc] bg-[#fdfbf5] px-4 py-3">
                        <p className="text-[12.5px] text-[#b87514] leading-relaxed">{contentTypeWarning}</p>
                    </div>
                )}
                {/* Content Type tabs + mode toggle + Generate button (same row) */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        {loadingTypes ? (
                            <div className="h-[46px] w-72 bg-[#ececea] rounded-[11px] animate-pulse" />
                        ) : contentTypes.length > 0 ? (
                            <div className="inline-flex flex-wrap gap-1 bg-[#ececea] rounded-[11px] p-1">
                                {contentTypes.map((ct) => {
                                    const Icon = resolveIcon(ct);
                                    const isActive = activeCode === ct.code;
                                    return (
                                        <button
                                            key={ct.id}
                                            type="button"
                                            onClick={() => handleSelectType(ct.code)}
                                            className={cn(
                                                'inline-flex items-center gap-2 px-4 py-[9px] rounded-[8px] text-[13.5px] font-bold transition-colors duration-150 outline-none',
                                                'focus-visible:ring-2 focus-visible:ring-primary/30',
                                                isActive
                                                    ? 'bg-white text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                                                    : 'bg-transparent text-[#7c7f87] hover:text-ink',
                                            )}
                                        >
                                            <Icon className="w-4 h-4" />
                                            <span>{ct.name}</span>
                                        </button>
                                    );
                                })}
                                <Link
                                    href="/settings"
                                    className={cn(
                                        'inline-flex items-center gap-2 px-4 py-[9px] rounded-[8px] text-[13.5px] font-bold transition-colors duration-150 outline-none',
                                        'focus-visible:ring-2 focus-visible:ring-primary/30 bg-transparent text-[#7c7f87] hover:text-ink',
                                    )}
                                >
                                    <SlidersHorizontal className="w-4 h-4" />
                                    <span>Custom</span>
                                    <ArrowUpRight className="w-3 h-3 text-[#aeb0b7]" />
                                </Link>
                            </div>
                        ) : null}

                        {contentTypes.length > 0 && (
                            <ModeToggle batch={batchMode} onChange={handleModeChange} />
                        )}
                    </div>

                    {contentTypes.length > 0 && (
                        <Button
                            type="submit"
                            form={FORM_ID}
                            size="md"
                            disabled={isGenerating}
                            className="shadow-button"
                        >
                            {batchMode ? `Generate ${batchCount} card${batchCount !== 1 ? 's' : ''}` : 'Generate'}
                            <kbd className="ml-2 text-xs font-semibold opacity-70 tracking-wide">⌘↵</kbd>
                        </Button>
                    )}
                </div>

                {/* Workspace — Form (blueprint-driven, no hardcoded branches) */}
                <div>
                    {!loadingTypes && (runtimeContentTypeError || contentTypes.length === 0) && (
                        <div className="rounded-xl border border-[#e3e3df] bg-white px-6 py-10 text-center shadow-sm">
                            <BookOpen className="mx-auto mb-3 h-9 w-9 text-slate-400" />
                            <h2 className="text-base font-bold text-ink">
                                {runtimeContentTypeError ? 'Content Type configuration needs attention' : 'No Content Types configured'}
                            </h2>
                            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
                                {runtimeContentTypeError
                                    ?? 'Create or activate a Content Type in Settings before creating cards.'}
                            </p>
                            <Link
                                href="/settings"
                                className={cn(
                                    'mt-5 inline-flex items-center justify-center rounded-[9px] px-3 py-1.5',
                                    'text-secondary font-bold gap-1.5 transition-all duration-150',
                                    'bg-white text-slate-600 border border-border hover:bg-surface active:scale-[0.98]',
                                    'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-bg',
                                    'focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
                                )}
                            >
                                Open Content Type settings
                            </Link>
                        </div>
                    )}
                    {blueprint && (
                        <CardForm
                            key={activeCode}
                            blueprint={blueprint}
                            batchMode={batchMode}
                            onGenerateStart={handleGenerateStart}
                            onStepUpdate={handleStepUpdate}
                            onGenerateEnd={handleGenerateEnd}
                            onBatchCountChange={setBatchCount}
                            onBatchProgress={handleBatchProgress}
                            registerCancel={(fn) => {
                                cancelRef.current = fn;
                            }}
                            formId={FORM_ID}
                        />
                    )}
                </div>
            </div>

            <LoadingOverlay
                open={isGenerating}
                title={batchMode ? 'Generating Cards' : 'Generating Cognitive Asset'}
                steps={
                    batchMode && batchProgress.total > 0
                        ? [
                              {
                                  label: `Generating cards ${batchProgress.done}/${batchProgress.total || batchCount}`,
                                  status: 'active' as const,
                              },
                          ]
                        : loadingSteps
                }
                progress={
                    batchMode && batchProgress.total > 0
                        ? Math.round((batchProgress.done / Math.max(1, batchProgress.total || batchCount)) * 100)
                        : progress
                }
                flowTip="Tip: Short example sentences help your brain retain words 3-5x faster than long definitions."
                onCancel={handleCancelGenerate}
            />
        </MotionPage>
    );
}
