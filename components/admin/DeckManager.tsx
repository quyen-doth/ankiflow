'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    deleteField,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, FieldWrapper, Select } from '@/components/ui/FormField';
import { Plus, Pencil, Search, RefreshCw, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useSortableList } from '@/hooks/useSortableList';
import { verifyAttrs } from '@/verify/core/contract';
import { getAnkiClientFromSettings } from '@/lib/flashcard-service/client';
import { ensureDeck, renameDeck, deleteDeckWithCleanup, setDeckSuspended, syncAllDecks } from '@/lib/flashcard-service/client-ops';
import { FormType, LanguageType } from '@/types';
import type { DeckConfig, LanguageCode } from '@/types';

/**
 * Đồng bộ deck với Anki client-side (browser → AnkiConnect của user); throw nếu Anki offline / lỗi.
 * Giữ chữ ký `{ op, ... }` để không đổi call site.
 */
async function postDeckSync(body: Record<string, unknown>): Promise<void> {
    const client = await getAnkiClientFromSettings();
    const op = (body.op as string) ?? 'ensure';
    switch (op) {
        case 'rename':
            await renameDeck(client, body.oldName as string, body.newName as string);
            break;
        case 'delete':
            await deleteDeckWithCleanup(client, body.deckName as string);
            break;
        case 'suspend':
            await setDeckSuspended(client, body.deckName as string, true);
            break;
        case 'unsuspend':
            await setDeckSuspended(client, body.deckName as string, false);
            break;
        case 'ensure':
        default:
            await ensureDeck(client, body.deckName as string);
            break;
    }
}

const FORM_TYPE_LABELS: Record<FormType, string> = {
    [FormType.LANGUAGE]: 'Language',
    [FormType.IT]: 'IT',
    [FormType.GENERAL]: 'General',
};

const LANGUAGE_LABELS: Record<string, string> = {
    [LanguageType.ENGLISH]: 'English',
    [LanguageType.JAPANESE]: 'Japanese',
    [LanguageType.CHINESE]: 'Chinese',
};

const NO_LANGUAGE = '__none__';

interface DeckDraft {
    anki_deck_name: string;
    display_name: string;
    form_type: FormType;
    language: LanguageCode | typeof NO_LANGUAGE;
    is_active: boolean;
    sort_order: number;
}

const EMPTY_DRAFT: DeckDraft = {
    anki_deck_name: '',
    display_name: '',
    form_type: FormType.LANGUAGE,
    language: NO_LANGUAGE,
    is_active: true,
    sort_order: 0,
};

interface DeckManagerProps {
    /** Chủ sở hữu docs đang sửa — mặc định uid của user hiện tại. Admin truyền `__defaults__`
     *  (DEFAULTS_OWNER_ID) để sửa template mà user mới nhận qua seedUserDefaults. */
    ownerId?: string;
}

export function DeckManager({ ownerId: ownerIdProp }: DeckManagerProps = {}) {
    const { user, loading: authLoading } = useAuth();
    const ownerId = ownerIdProp ?? user?.uid;
    const [decks, setDecks] = useState<DeckConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<DeckConfig | null>(null);
    const [draft, setDraft] = useState<DeckDraft>(EMPTY_DRAFT);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<DeckConfig | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const toast = useToast();

    const [search, setSearch] = useState('');
    const [filterFormType, setFilterFormType] = useState<FormType | ''>('');
    const [filterLanguage, setFilterLanguage] = useState<LanguageCode | ''>('');
    const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | ''>('');

    const filteredDecks = useMemo(() => {
        return decks.filter((d) => {
            if (search) {
                const q = search.toLowerCase();
                if (!d.display_name.toLowerCase().includes(q) && !d.anki_deck_name.toLowerCase().includes(q))
                    return false;
            }
            if (filterFormType && d.form_type !== filterFormType) return false;
            if (filterLanguage && d.language !== filterLanguage) return false;
            if (filterStatus === 'active' && !d.is_active) return false;
            if (filterStatus === 'inactive' && d.is_active) return false;
            return true;
        });
    }, [decks, search, filterFormType, filterLanguage, filterStatus]);

    const activeFilters: { key: string; label: string }[] = [];
    if (filterFormType) activeFilters.push({ key: 'formType', label: FORM_TYPE_LABELS[filterFormType] });
    if (filterLanguage) activeFilters.push({ key: 'language', label: LANGUAGE_LABELS[filterLanguage] });
    if (filterStatus) activeFilters.push({ key: 'status', label: filterStatus === 'active' ? 'Active' : 'Inactive' });

    const removeFilter = (key: string) => {
        if (key === 'formType') setFilterFormType('');
        if (key === 'language') setFilterLanguage('');
        if (key === 'status') setFilterStatus('');
    };

    const clearAllFilters = () => {
        setSearch('');
        setFilterFormType('');
        setFilterLanguage('');
        setFilterStatus('');
    };

    useEffect(() => {
        if (authLoading || !ownerId) return;
        async function fetchDecks() {
            setLoading(true);
            try {
                // Sort in-memory thay orderBy — tránh composite index (user_id, sort_order)
                const q = query(collection(db, 'decks'), where('user_id', '==', ownerId));
                const snapshot = await getDocs(q);
                setDecks(
                    snapshot.docs
                        .map((d) => ({ id: d.id, ...d.data() }) as DeckConfig)
                        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
                );
            } catch (error) {
                console.error('Error fetching decks:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchDecks();
    }, [refreshKey, ownerId, authLoading]);

    const refresh = () => setRefreshKey((k) => k + 1);
    const handleReorder = useSortableList<DeckConfig>('decks', setDecks, refresh);
    const canReorder = !search && activeFilters.length === 0;

    const openCreate = () => {
        setEditing(null);
        setDraft(EMPTY_DRAFT);
        setModalOpen(true);
    };

    const openEdit = (deck: DeckConfig) => {
        setEditing(deck);
        setDraft({
            anki_deck_name: deck.anki_deck_name,
            display_name: deck.display_name,
            form_type: deck.form_type,
            language: deck.language || NO_LANGUAGE,
            is_active: deck.is_active,
            sort_order: deck.sort_order,
        });
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!draft.anki_deck_name.trim() || !draft.display_name.trim()) return;
        setSaving(true);
        const isEditing = !!editing;
        const oldName = editing?.anki_deck_name;
        try {
            if (editing) {
                await updateDoc(doc(db, 'decks', editing.id), {
                    anki_deck_name: draft.anki_deck_name,
                    display_name: draft.display_name,
                    form_type: draft.form_type,
                    language: draft.language === NO_LANGUAGE ? deleteField() : draft.language,
                    is_active: draft.is_active,
                    sort_order: draft.sort_order,
                    updated_at: serverTimestamp(),
                });
            } else {
                await addDoc(collection(db, 'decks'), {
                    user_id: ownerId,
                    anki_deck_name: draft.anki_deck_name,
                    display_name: draft.display_name,
                    form_type: draft.form_type,
                    ...(draft.language !== NO_LANGUAGE && { language: draft.language }),
                    is_active: draft.is_active,
                    sort_order: draft.sort_order,
                    default_card_type_ids: [],
                    created_at: serverTimestamp(),
                    updated_at: serverTimestamp(),
                });
            }
            setModalOpen(false);
            refresh();

            try {
                const name = draft.anki_deck_name;
                if (isEditing && oldName && oldName !== name) {
                    await postDeckSync({ op: 'rename', oldName, newName: name });
                } else {
                    await postDeckSync({ op: 'ensure', deckName: name });
                }
                await postDeckSync({ op: draft.is_active ? 'unsuspend' : 'suspend', deckName: name });
                toast.success(isEditing ? 'Saved & synced deck with Anki' : 'Created deck & synced with Anki');
            } catch (e) {
                console.error('AnkiConnect sync failed:', e);
                toast.warning('Saved deck, but Anki sync failed — is Anki open?');
            }
        } catch (error) {
            console.error('Error saving deck:', error);
            toast.error('Failed to save deck. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (deckConfig: DeckConfig) => {
        const next = !deckConfig.is_active;
        try {
            await updateDoc(doc(db, 'decks', deckConfig.id), { is_active: next, updated_at: serverTimestamp() });
            refresh();
            try {
                await postDeckSync({ op: next ? 'unsuspend' : 'suspend', deckName: deckConfig.anki_deck_name });
                toast.success(
                    next ? 'Activated deck & unsuspended cards in Anki' : 'Deactivated deck & suspended cards in Anki',
                );
            } catch (e) {
                console.error('AnkiConnect sync failed:', e);
                toast.warning('Status updated, but Anki sync failed.');
            }
        } catch (error) {
            console.error('Error toggling deck status:', error);
            toast.error('Failed to update deck status.');
        }
    };

    const handleSyncAll = async () => {
        if (decks.length === 0) return;
        setSyncing(true);
        try {
            const client = await getAnkiClientFromSettings();
            const data = await syncAllDecks(
                client,
                decks.map((d) => ({ name: d.anki_deck_name, is_active: d.is_active })),
            );
            if (data.failed.length) {
                toast.warning(`Synced ${data.synced}/${data.total} decks. Some failed — is Anki open?`);
            } else {
                toast.success(`Synced ${data.synced} decks with Anki`);
            }
        } catch (e) {
            console.error('Sync-all failed:', e);
            toast.error('Failed to sync with Anki. Make sure Anki is open.');
        } finally {
            setSyncing(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        const target = deleteTarget;
        try {
            await postDeckSync({ op: 'delete', deckName: target.anki_deck_name });
            await deleteDoc(doc(db, 'decks', target.id));
            setDeleteTarget(null);
            refresh();
            toast.success('Deleted deck from AnkiFlow and Anki');
        } catch (error) {
            console.error('Error deleting deck:', error);
            toast.error('Delete failed — make sure Anki is open.');
        } finally {
            setDeleting(false);
        }
    };

    const columns = [
        {
            key: 'anki_deck_name',
            header: 'Anki Name',
            render: (_: unknown, row: DeckConfig) => (
                <span className="font-mono text-overline text-slate-600">{row.anki_deck_name}</span>
            ),
        },
        {
            key: 'display_name',
            header: 'Display Name',
            render: (_: unknown, row: DeckConfig) => <span className="font-semibold text-ink">{row.display_name}</span>,
        },
        {
            key: 'form_type',
            header: 'Form Type',
            render: (_: unknown, row: DeckConfig) => (
                <Badge variant="neutral">{FORM_TYPE_LABELS[row.form_type] ?? row.form_type}</Badge>
            ),
        },
        {
            key: 'language',
            header: 'Language',
            render: (_: unknown, row: DeckConfig) => (
                <span className="text-slate-600">
                    {row.language ? (LANGUAGE_LABELS[row.language] ?? row.language) : '—'}
                </span>
            ),
        },
        {
            key: 'is_active',
            header: 'Status',
            render: (_: unknown, row: DeckConfig) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleToggleActive(row);
                    }}
                >
                    <Badge variant={row.is_active ? 'active' : 'inactive'}>
                        {row.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                </button>
            ),
        },
        {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (_: unknown, row: DeckConfig) => (
                <div className="flex items-center justify-end gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit deck ${row.display_name}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            openEdit(row);
                        }}
                        className="p-2 h-auto rounded-full"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete deck ${row.display_name}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(row);
                        }}
                        className="p-2 h-auto text-slate-600 hover:text-danger hover:bg-danger-bg rounded-full"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <Card
            {...verifyAttrs({
                unit: 'DeckManager',
                rows: decks.length,
                filteredRows: filteredDecks.length,
                modalOpen,
                loading,
            })}
        >
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-body font-bold font-semibold text-slate-600">Decks</h2>
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        aria-label="Sync with Anki"
                        title="Sync with Anki"
                        onClick={handleSyncAll}
                        disabled={syncing || decks.length === 0}
                        leftIcon={<RefreshCw className={`w-4 h-4${syncing ? ' animate-spin' : ''}`} />}
                    >
                        {/* {syncing ? 'Syncing…' : 'Sync Anki'} */}
                    </Button>
                    <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate}>
                        Add Deck
                    </Button>
                </div>
            </div>

            {/* Filter bar */}
            <div className="flex flex-col gap-3 mb-4">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-[14px] top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400/70" />
                        <input
                            type="search"
                            placeholder="Search decks..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full h-[46px] bg-[#fcfcfb] border border-[#e3e3de] rounded-[10px] pl-10 pr-[14px] text-[15px] text-ink placeholder:text-slate-400/70 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-bg transition-shadow"
                        />
                    </div>
                    <Select
                        aria-label="Filter by content type"
                        value={filterFormType}
                        onChange={(e) => setFilterFormType(e.target.value as FormType | '')}
                        className="!w-auto min-w-[130px]"
                    >
                        <option value="">All Types</option>
                        {Object.values(FormType).map((ft) => (
                            <option key={ft} value={ft}>
                                {FORM_TYPE_LABELS[ft]}
                            </option>
                        ))}
                    </Select>
                    <Select
                        aria-label="Filter by language"
                        value={filterLanguage}
                        onChange={(e) => setFilterLanguage(e.target.value as LanguageType | '')}
                        className="!w-auto min-w-[130px]"
                    >
                        <option value="">All Languages</option>
                        {Object.values(LanguageType).map((lang) => (
                            <option key={lang} value={lang}>
                                {LANGUAGE_LABELS[lang]}
                            </option>
                        ))}
                    </Select>
                    <Select
                        aria-label="Filter by status"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as 'active' | 'inactive' | '')}
                        className="!w-auto min-w-[110px]"
                    >
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </Select>
                </div>
                {activeFilters.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs uppercase tracking-wider text-on-surface-var/60 font-mono">
                            Applied:
                        </span>
                        {activeFilters.map((f) => (
                            <Badge key={f.key} variant="active" onRemove={() => removeFilter(f.key)}>
                                {f.label}
                            </Badge>
                        ))}
                        <button
                            onClick={clearAllFilters}
                            className="text-xs text-on-surface-var hover:text-error underline transition-colors"
                        >
                            Clear all
                        </button>
                    </div>
                )}
            </div>

            <DataTable
                data={filteredDecks}
                columns={columns}
                keyField="id"
                onRowClick={(row) => openEdit(row)}
                onReorder={canReorder ? handleReorder : undefined}
                emptyMessage={
                    loading
                        ? 'Loading decks...'
                        : filteredDecks.length === 0 && decks.length > 0
                          ? 'No decks match your filters.'
                          : 'No decks yet.'
                }
            />

            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onConfirm={handleSave}
                title={editing ? 'Edit Deck' : 'Add Deck'}
                size="md"
            >
                <div className="flex flex-col gap-4">
                    <FieldWrapper label="Anki Deck Name">
                        <Input
                            value={draft.anki_deck_name}
                            onChange={(e) => setDraft((d) => ({ ...d, anki_deck_name: e.target.value }))}
                            placeholder="e.g. AnkiFlow::English::Vocabulary"
                        />
                    </FieldWrapper>
                    <FieldWrapper label="Display Name">
                        <Input
                            value={draft.display_name}
                            onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))}
                            placeholder="e.g. English Vocabulary"
                        />
                    </FieldWrapper>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FieldWrapper label="Form Type">
                            <Select
                                aria-label="Form Type"
                                value={draft.form_type}
                                onChange={(e) => setDraft((d) => ({ ...d, form_type: e.target.value as FormType }))}
                            >
                                {Object.values(FormType).map((ft) => (
                                    <option key={ft} value={ft}>
                                        {FORM_TYPE_LABELS[ft]}
                                    </option>
                                ))}
                            </Select>
                        </FieldWrapper>
                        <FieldWrapper label="Language">
                            <Select
                                aria-label="Language"
                                value={draft.language}
                                onChange={(e) =>
                                    setDraft((d) => ({
                                        ...d,
                                        language: e.target.value as LanguageType | typeof NO_LANGUAGE,
                                    }))
                                }
                            >
                                <option value={NO_LANGUAGE}>—</option>
                                {Object.values(LanguageType).map((lang) => (
                                    <option key={lang} value={lang}>
                                        {LANGUAGE_LABELS[lang]}
                                    </option>
                                ))}
                            </Select>
                        </FieldWrapper>
                    </div>
                    <FieldWrapper label="Sort Order">
                        <Input
                            type="number"
                            aria-label="Sort Order"
                            value={draft.sort_order}
                            onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) }))}
                        />
                    </FieldWrapper>

                    <div className="flex gap-3 justify-end mt-2">
                        <Button variant="ghost" onClick={() => setModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleSave}
                            disabled={saving || !draft.anki_deck_name.trim() || !draft.display_name.trim()}
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Permanently delete deck"
                size="sm"
            >
                <p className="text-sm text-slate-600">
                    Delete <span className="font-semibold text-ink">{deleteTarget?.display_name}</span>?
                    This permanently removes the deck from AnkiFlow and Anki,{' '}
                    <span className="font-semibold text-danger">including all cards inside</span>. This cannot be undone.
                </p>
                <div className="flex gap-3 justify-end mt-5">
                    <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                        {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                </div>
            </Modal>
        </Card>
    );
}
