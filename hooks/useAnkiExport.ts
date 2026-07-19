'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { buildNotes } from '@/lib/buildNotes';
import { getAnkiClientFromSettings } from '@/lib/flashcard-service/client';
import { ensureModel, createNotesForEntry } from '@/lib/flashcard-service/client-ops';
import type { Entry, CardTemplate } from '@/types';

export { buildNotes };

interface CardTypeItem {
    id: string;
    name: string;
    code?: string;
    template?: CardTemplate;
}

interface AnkiExportOptions {
    entry: Partial<Entry>;
    selectedCardTypeIds: string[];
    cardTypes?: CardTypeItem[];
}

interface AnkiExportState {
    confirmOpen: boolean;
    setConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isExporting: boolean;
    handleConfirm: () => Promise<void>;
}

/**
 * AnkiFlow-Basic model の存在を保証する。note 作成前に 1 回呼ぶ (batch 含む)。
 * best-effort: 接続エラーは exportEntryToAnki の addNotes 段階で改めて表面化する。
 */
export async function ensureAnkiModel(): Promise<void> {
    try {
        const client = await getAnkiClientFromSettings();
        await ensureModel(client);
    } catch (e) {
        console.warn('Could not ensure AnkiFlow-Basic model:', e);
    }
}

export interface ExportEntryResult {
    ok: boolean;
    error?: string;
    noteCount: number;
}

/**
 * Export 1 entry sang Anki (client-side): store media → buildNotes → createDeck + addNotes
 * user の AnkiConnect を直接呼ぶ (sidebar sync と共用の `createNotesForEntry` 経由)
 * → persist entry (status 'synced') qua /api/entries/save.
 * ensure-model はしない (ensureAnkiModel() を別途 1 回呼ぶ) し、画面遷移もしない —
 * 単体・batch 両フローで使用可能。toast ではなく結果を返す。
 */
export async function exportEntryToAnki(
    entry: Partial<Entry>,
    selectedTypes: CardTypeItem[],
): Promise<ExportEntryResult> {
    const noteCount = selectedTypes.length;

    try {
        const client = await getAnkiClientFromSettings();
        const noteIds = await createNotesForEntry(client, entry, selectedTypes);

        // note ids + status 'synced' で entry を Firestore に永続化
        const saved = await saveEntryToFirestore(entry, selectedTypes, { ankiNoteIds: noteIds, status: 'synced' });
        if (!saved.ok) {
            return { ok: false, error: saved.error || 'Created in Anki but failed to save entry', noteCount };
        }
        return { ok: true, noteCount };
    } catch (err) {
        return { ok: false, error: (err as Error).message, noteCount };
    }
}

export async function saveEntryToFirestore(
    entry: Partial<Entry>,
    selectedTypes: CardTypeItem[],
    opts?: { ankiNoteIds?: number[]; status?: Entry['status'] },
): Promise<{ ok: boolean; error?: string; entryId?: string }> {
    const entryData = {
        ...entry,
        card_type_ids: selectedTypes.map((t) => t.id),
    };

    try {
        const res = await fetch('/api/entries/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                entryData,
                ...(opts?.ankiNoteIds !== undefined && { anki_note_ids: opts.ankiNoteIds }),
                ...(opts?.status !== undefined && { status: opts.status }),
            }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { ok: false, error: err.error || 'Save failed' };
        }
        const data = await res.json();
        return { ok: true, entryId: data.entryId };
    } catch (err) {
        return { ok: false, error: (err as Error).message };
    }
}

export function useAnkiExport({ entry, selectedCardTypeIds, cardTypes = [] }: AnkiExportOptions): AnkiExportState {
    const router = useRouter();
    const toast = useToast();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const handleConfirm = async () => {
        setIsExporting(true);
        setConfirmOpen(false);

        try {
            await ensureAnkiModel();
            const selectedTypes = cardTypes.filter((ct) => selectedCardTypeIds.includes(ct.id));
            const result = await exportEntryToAnki(entry, selectedTypes);

            if (!result.ok) {
                console.error('Anki export failed:', result.error);
                toast.error(`Export failed: ${result.error || 'Unknown error'}`);
            } else {
                toast.success(`Created ${result.noteCount} cards in Anki`);
                // 成功フィードバックは上の toast が担当 — create 側の ?exported= バナーは廃止済み。
                router.push('/create');
            }
        } catch (err) {
            console.error('Anki connection error:', err);
            toast.error('Cannot connect to AnkiConnect. Make sure Anki is open.');
        } finally {
            setIsExporting(false);
        }
    };

    return { confirmOpen, setConfirmOpen, isExporting, handleConfirm };
}
