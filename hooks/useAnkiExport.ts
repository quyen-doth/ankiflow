'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { buildNotes } from '@/lib/buildNotes';
import { getAnkiClientFromSettings } from '@/lib/flashcard-service/client';
import { ensureModel } from '@/lib/flashcard-service/client-ops';
import type { IFlashcardService } from '@/lib/flashcard-service/types';
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
 * Đảm bảo model AnkiFlow-Basic tồn tại. Gọi 1 lần trước khi tạo note (kể cả batch).
 * Best-effort: lỗi kết nối sẽ được surfaced lại ở bước addNotes của exportEntryToAnki.
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

const sanitizeFilename = (s: string) => s.replace(/[\s/\\:*?"<>|]/g, '_');

/** Lưu audio data-URL vào Anki media, trả tên file đã lưu (undefined nếu bỏ qua/lỗi — best-effort). */
async function storeAudioMedia(client: IFlashcardService, entry: Partial<Entry>): Promise<string | undefined> {
    if (!entry.audio_url || !entry.audio_url.startsWith('data:audio')) return undefined;
    const base64 = entry.audio_url.split(',')[1];
    if (!base64) return undefined;
    const word = entry.word || entry.term || entry.title || 'audio';
    const fname = `ankiflow_${sanitizeFilename(word)}.mp3`;
    try {
        return await client.storeMediaFile(fname, base64);
    } catch (e) {
        console.warn('Failed to store audio in Anki media — cards will export without audio:', e);
        return undefined;
    }
}

/** Lưu ảnh cục bộ (data-URL) vào Anki media, trả tên file đã lưu (undefined nếu bỏ qua/lỗi). */
async function storeImageMedia(client: IFlashcardService, entry: Partial<Entry>): Promise<string | undefined> {
    if (!entry.image_url || !entry.image_url.startsWith('data:image')) return undefined;
    const match = entry.image_url.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.*)$/);
    const base64 = match?.[2];
    if (!base64) return undefined;
    const ext = (match?.[1] || 'png').replace('jpeg', 'jpg');
    const word = entry.word || entry.term || entry.title || 'image';
    const fname = `ankiflow_img_${sanitizeFilename(word)}.${ext}`;
    try {
        return await client.storeMediaFile(fname, base64);
    } catch (e) {
        console.warn('Failed to store image in Anki media — cards will export without image:', e);
        return undefined;
    }
}

/**
 * Export 1 entry sang Anki (client-side): store media → buildNotes → createDeck + addNotes
 * trực tiếp qua AnkiConnect của user → persist entry (status 'synced') qua /api/entries/save.
 * KHÔNG ensure-model (gọi ensureAnkiModel() riêng 1 lần) và KHÔNG điều hướng — dùng được
 * cho cả luồng đơn lẫn batch. Trả về kết quả thay vì toast.
 */
export async function exportEntryToAnki(
    entry: Partial<Entry>,
    selectedTypes: CardTypeItem[],
): Promise<ExportEntryResult> {
    const noteCount = selectedTypes.length;

    try {
        const client = await getAnkiClientFromSettings();

        // Step 1: store audio + image vào Anki media (best-effort)
        const audioFilename = await storeAudioMedia(client, entry);
        const imageFilename = await storeImageMedia(client, entry);

        // Step 2: build notes (audio + image nhúng vào mọi card type)
        const notes = buildNotes(entry, selectedTypes, audioFilename, imageFilename);

        // Step 3: đảm bảo mọi deck tồn tại (idempotent), rồi tạo notes trong Anki
        const deckNames = [...new Set(notes.map((n) => n.deckName).filter((d): d is string => !!d))];
        for (const deckName of deckNames) {
            await client.createDeck(deckName);
        }
        const noteIds = await client.addNotes(notes);

        // Step 4: persist entry vào Firestore với note ids + status 'synced'
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
                router.push(`/create?exported=1&count=${result.noteCount}`);
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
