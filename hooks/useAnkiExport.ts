'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { buildNotes } from '@/lib/buildNotes';
import type { Entry } from '@/types';

export { buildNotes };

interface CardTypeItem {
    id: string;
    name: string;
    code?: string;
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

/** Đảm bảo model AnkiFlow-Basic tồn tại. Gọi 1 lần trước khi tạo note (kể cả batch). */
export async function ensureAnkiModel(): Promise<void> {
    try {
        await fetch('/api/anki/ensure-model', { method: 'POST' });
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
 * Export 1 entry sang Anki: lưu audio (nếu có) → buildNotes → POST /api/anki/create.
 * KHÔNG ensure-model (gọi ensureAnkiModel() riêng 1 lần) và KHÔNG điều hướng — để
 * dùng được cho cả luồng đơn lẫn batch. Trả về kết quả thay vì toast.
 */
export async function exportEntryToAnki(
    entry: Partial<Entry>,
    selectedTypes: CardTypeItem[],
): Promise<ExportEntryResult> {
    const noteCount = selectedTypes.length;

    // Step 1: Store audio in Anki media folder
    let audioFilename: string | undefined;
    if (entry.audio_url && entry.audio_url.startsWith('data:audio')) {
        const base64 = entry.audio_url.split(',')[1];
        if (base64) {
            const word = entry.word || entry.term || entry.title || 'audio';
            const fname = `ankiflow_${word.replace(/[\s/\\:*?"<>|]/g, '_')}.mp3`;
            try {
                const storeRes = await fetch('/api/audio/store', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64, filename: fname }),
                });
                if (storeRes.ok) {
                    const storeData = await storeRes.json();
                    audioFilename = storeData.filename || fname;
                } else {
                    console.warn('Audio store returned non-OK status:', storeRes.status);
                }
            } catch (e) {
                console.warn('Failed to store audio in Anki media — cards will export without audio:', e);
            }
        }
    }

    // Step 1b: Store ảnh cục bộ (data URL) vào Anki media folder
    let imageFilename: string | undefined;
    if (entry.image_url && entry.image_url.startsWith('data:image')) {
        const match = entry.image_url.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.*)$/);
        const ext = (match?.[1] || 'png').replace('jpeg', 'jpg');
        const base64 = match?.[2];
        if (base64) {
            const word = entry.word || entry.term || entry.title || 'image';
            const fname = `ankiflow_img_${word.replace(/[\s/\\:*?"<>|]/g, '_')}.${ext}`;
            try {
                const storeRes = await fetch('/api/image/store', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64, filename: fname }),
                });
                if (storeRes.ok) {
                    const storeData = await storeRes.json();
                    imageFilename = storeData.filename || fname;
                } else {
                    console.warn('Image store returned non-OK status:', storeRes.status);
                }
            } catch (e) {
                console.warn('Failed to store image in Anki media — cards will export without image:', e);
            }
        }
    }

    // Step 2: Build notes with audio + image embedded in all card types
    const notes = buildNotes(entry, selectedTypes, audioFilename, imageFilename);

    const entryData = {
        ...entry,
        card_type_ids: selectedTypes.map((t) => t.id),
        status: 'exported',
    };

    // Step 3: Create notes in Anki
    try {
        const res = await fetch('/api/anki/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes, entryData }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { ok: false, error: err.error || 'Unknown error', noteCount };
        }
        return { ok: true, noteCount };
    } catch (err) {
        return { ok: false, error: (err as Error).message, noteCount };
    }
}

export async function saveEntryToFirestore(
    entry: Partial<Entry>,
    selectedTypes: CardTypeItem[],
): Promise<{ ok: boolean; error?: string; entryId?: string }> {
    const entryData = {
        ...entry,
        card_type_ids: selectedTypes.map((t) => t.id),
    };

    try {
        const res = await fetch('/api/entries/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryData }),
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
