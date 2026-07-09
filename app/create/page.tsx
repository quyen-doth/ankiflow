'use client';

import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useRouter } from 'next/navigation';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CardForm } from '@/components/create/CardForm';
import { ModeToggle } from '@/components/create/ModeToggle';
import { MotionPage } from '@/components/ui/MotionPage';
import { getBlueprintForContentType, resolveBuiltinFormType } from '@/lib/create/formBlueprint';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
    Languages,
    Terminal,
    BookOpen,
    SlidersHorizontal,
    ArrowUpRight,
    CheckCircle,
    X,
    PlusCircle,
} from 'lucide-react';
import { FormType } from '@/types';
import type { ContentType } from '@/types';

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
    { label: 'Calling Claude AI', status: 'active' },
    { label: 'Generating audio (TTS)', status: 'pending' },
    { label: 'Finding images (Unsplash)', status: 'pending' },
];

const FORM_ID = 'create-form';

function resolveIcon(contentType: ContentType): React.ElementType {
    const ft = resolveBuiltinFormType(contentType.id) ?? resolveBuiltinFormType(contentType.code);
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

function CreateContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
    const [loadingTypes, setLoadingTypes] = useState(true);
    const [activeCode, setActiveCode] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>(INITIAL_STEPS);
    const [progress, setProgress] = useState(0);
    const [canSubmit, setCanSubmit] = useState(false);
    const [successBanner, setSuccessBanner] = useState<{ count: number } | null>(null);
    const [batchMode, setBatchMode] = useState(false);
    const [batchCount, setBatchCount] = useState(0);
    const [batchProgress, setBatchProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
    const cancelRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        async function fetchContentTypes() {
            try {
                const q = query(
                    collection(db, 'content_types'),
                    where('is_active', '==', true),
                    orderBy('sort_order', 'asc'),
                );
                const snapshot = await getDocs(q);
                const types = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ContentType);
                setContentTypes(types);
                if (types.length > 0 && !activeCode) {
                    setActiveCode(types[0].code);
                    setBatchMode(types[0].default_create_mode === 'batch');
                }
            } catch (error) {
                console.error('Error fetching content types:', error);
            } finally {
                setLoadingTypes(false);
            }
        }
        fetchContentTypes();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (searchParams.get('exported') === '1') {
            const count = parseInt(searchParams.get('count') || '0', 10);
            const showTimer = setTimeout(() => setSuccessBanner({ count }), 0);
            const hideTimer = setTimeout(() => setSuccessBanner(null), 5000);
            router.replace('/create', { scroll: false });
            return () => {
                clearTimeout(showTimer);
                clearTimeout(hideTimer);
            };
        }
    }, [searchParams, router]);

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
            setCanSubmit(false);
            setBatchCount(0);
        },
        [contentTypes],
    );

    const handleModeChange = useCallback((batch: boolean) => {
        setBatchMode(batch);
        setCanSubmit(false);
        setBatchCount(0);
    }, []);

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
                if (!canSubmit || isGenerating) return;
                const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
                form?.requestSubmit();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [canSubmit, isGenerating]);

    const blueprint = useMemo(() => {
        return activeType ? getBlueprintForContentType(activeType) : null;
    }, [activeType]);

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

            <AnimatePresence>
                {successBanner && (
                    <motion.div
                        className="max-w-6xl mx-auto w-full px-0 mb-2 overflow-hidden"
                        initial={{ opacity: 0, height: 0, y: -8 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -8 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="flex items-center gap-3 bg-primary-bg border border-primary/30 rounded-card px-5 py-3">
                            <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                            <p className="text-sm font-medium text-ink flex-1">
                                Successfully exported {successBanner.count} card{successBanner.count !== 1 ? 's' : ''}{' '}
                                to Anki!
                            </p>
                            <button
                                type="button"
                                onClick={() => setSuccessBanner(null)}
                                className="text-slate-600 hover:text-ink"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-6xl mx-auto w-full pb-6 flex flex-col gap-6">
                {/* Content Type tabs + mode toggle + Generate button (same row) */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        {loadingTypes ? (
                            <div className="h-[46px] w-72 bg-[#ececea] rounded-[11px] animate-pulse" />
                        ) : (
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
                                <button
                                    type="button"
                                    onClick={() => router.push('/admin?tab=content-types')}
                                    className={cn(
                                        'inline-flex items-center gap-2 px-4 py-[9px] rounded-[8px] text-[13.5px] font-bold transition-colors duration-150 outline-none',
                                        'focus-visible:ring-2 focus-visible:ring-primary/30 bg-transparent text-[#7c7f87] hover:text-ink',
                                    )}
                                >
                                    <SlidersHorizontal className="w-4 h-4" />
                                    <span>Custom</span>
                                    <ArrowUpRight className="w-3 h-3 text-[#aeb0b7]" />
                                </button>
                            </div>
                        )}

                        <ModeToggle batch={batchMode} onChange={handleModeChange} />
                    </div>

                    <Button
                        type="submit"
                        form={FORM_ID}
                        size="md"
                        disabled={!canSubmit || isGenerating}
                        className="shadow-button"
                    >
                        {batchMode ? `Generate ${batchCount} card${batchCount !== 1 ? 's' : ''}` : 'Generate'}
                        <kbd className="ml-2 text-xs font-semibold opacity-70 tracking-wide">⌘↵</kbd>
                    </Button>
                </div>

                {/* Workspace — Form (blueprint-driven, no hardcoded branches) */}
                <div>
                    {blueprint && (
                        <CardForm
                            key={activeCode}
                            blueprint={blueprint}
                            batchMode={batchMode}
                            onGenerateStart={handleGenerateStart}
                            onStepUpdate={handleStepUpdate}
                            onGenerateEnd={handleGenerateEnd}
                            onValidityChange={setCanSubmit}
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
                    batchMode
                        ? [
                              {
                                  label: `Generating cards ${batchProgress.done}/${batchProgress.total || batchCount}`,
                                  status: 'active' as const,
                              },
                          ]
                        : loadingSteps
                }
                progress={
                    batchMode
                        ? Math.round((batchProgress.done / Math.max(1, batchProgress.total || batchCount)) * 100)
                        : progress
                }
                flowTip="Tip: Short example sentences help your brain retain words 3-5x faster than long definitions."
                onCancel={handleCancelGenerate}
            />
        </MotionPage>
    );
}
