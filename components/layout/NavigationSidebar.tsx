'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PlusCircle, History, Shield, Settings, Wrench, Menu, X, LogOut } from 'lucide-react';
import { AnkiFlowLogo } from '@/components/ui/AnkiFlowLogo';
import { ConnectedBadge } from '@/components/ui/ConnectedBadge';
import { useUnsyncedCount } from '@/hooks/useUnsyncedCount';
import { useAuth } from '@/components/providers/AuthProvider';
import { logout } from '@/lib/auth';
import { getAnkiClientFromSettings } from '@/lib/flashcard-service/client';
import { ensureModel, createNotesForEntry } from '@/lib/flashcard-service/client-ops';
import { cn } from '@/lib/utils';
import { useConfirmNavigation } from '@/hooks/useUnsavedChangesGuard';
import { verifyAttrs } from '@/verify/core/contract';

const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Create Card', href: '/create', icon: PlusCircle },
    { label: 'History', href: '/history', icon: History },
    { label: 'Admin', href: '/admin', icon: Shield },
    { label: 'Settings', href: '/settings', icon: Settings },
    { label: 'App Settings', href: '/settings/admin', icon: Wrench, adminOnly: true },
] as const;

export function NavigationSidebar() {
    const pathname = usePathname();
    const { user } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [lastPathname, setLastPathname] = useState(pathname);
    const unsyncedCount = useUnsyncedCount();
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<string | null>(null);
    const [signingOut, setSigningOut] = useState(false);
    const confirmNavigation = useConfirmNavigation();

    const handleSignOut = useCallback(async () => {
        confirmNavigation(async () => {
            setSigningOut(true);
            await logout();
            // Full reload: xóa sạch client state + để middleware nhận cookie đã bị xóa
            window.location.href = '/login';
        });
    }, [confirmNavigation]);

    const handleSync = useCallback(async () => {
        setIsSyncing(true)
        setSyncResult(null)
        try {
            // 1. Lấy các entry reviewed + card_types từ server (server không đụng Anki).
            const res = await fetch('/api/entries/sync', { cache: 'no-store' })
            const { jobs } = await res.json()
            if (!jobs || jobs.length === 0) {
                setSyncResult('Nothing to sync')
                return
            }

            // 2. Tạo note trong Anki của user (browser → localhost:8765).
            //    createNotesForEntry dùng chung với export trực tiếp — kèm store audio/image.
            const client = await getAnkiClientFromSettings()
            await ensureModel(client)

            const results: { entryId: string; noteIds: number[] }[] = []
            let ankiFailed = 0
            for (const job of jobs) {
                try {
                    const noteIds = await createNotesForEntry(client, job.entry, job.cardTypes)
                    results.push({ entryId: job.entryId, noteIds })
                } catch {
                    ankiFailed++
                }
            }

            if (results.length === 0) {
                setSyncResult('Sync failed')
                return
            }

            // 3. Báo kết quả về server để cập nhật status → synced.
            //    PHẢI kiểm tra kết quả: notes đã nằm trong Anki — nếu status không được
            //    ghi thì lần sync sau sẽ tạo notes trùng lặp.
            const postRes = await fetch('/api/entries/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ results }),
            })
            if (!postRes.ok) {
                setSyncResult('Sync incomplete — status not saved')
                return
            }
            const { synced = 0, failed: persistFailed = 0 } = await postRes.json()

            const failed = ankiFailed + persistFailed
            if (synced > 0 && failed === 0) {
                setSyncResult(`Synced ${synced} cards`)
            } else if (synced > 0) {
                setSyncResult(`Synced ${synced}, failed ${failed}`)
            } else {
                setSyncResult('Sync failed')
            }
        } catch {
            setSyncResult('Sync error')
        } finally {
            setIsSyncing(false)
            setTimeout(() => setSyncResult(null), 4000)
        }
    }, [])

    if (pathname !== lastPathname) {
        setLastPathname(pathname);
        setMobileOpen(false);
    }

    const isAdmin = !!user?.email && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    const visibleNavItems = navItems.filter((item) => !('adminOnly' in item && item.adminOnly) || isAdmin);

    // Longest-prefix wins: khi ở /settings/admin, chỉ mục /settings/admin sáng (không phải cả /settings).
    const activeHref = visibleNavItems
        .filter((item) => pathname === item.href || pathname?.startsWith(item.href + '/'))
        .reduce<string | null>((best, item) => (best && best.length >= item.href.length ? best : item.href), null);

    const nav = (
        <nav className="flex-1 flex flex-col gap-[2px]">
            {visibleNavItems.map(({ label, href, icon: Icon }) => {
                const isActive = href === activeHref;
                return (
                    <Link
                        key={href}
                        href={href}
                        className={cn(
                            'relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-[7px] text-[12.5px] transition-colors duration-150',
                            isActive
                                ? 'bg-[rgba(49,99,66,0.1)] text-primary font-bold'
                                : 'text-slate-600 font-medium hover:bg-[#F0F0EC] hover:text-ink',
                        )}
                    >
                        {isActive && (
                            <span className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-[2.5px] h-[16px] bg-primary rounded-r-[3px]" />
                        )}
                        <Icon
                            className={cn(
                                'w-[15px] h-[15px] flex-shrink-0',
                                isActive ? 'text-primary' : 'text-slate-600',
                            )}
                        />
                        <span>{label}</span>
                        {label === 'History' && unsyncedCount > 0 && (
                            <span className="ml-auto bg-amber text-white text-[10px] font-bold leading-none rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                {unsyncedCount > 99 ? '99+' : unsyncedCount}
                            </span>
                        )}
                    </Link>
                );
            })}
        </nav>
    );

    return (
        <>
            {/* Mobile top bar */}
            <header className="md:hidden fixed top-0 left-0 right-0 z-30 h-16 flex items-center justify-between px-4 bg-surface border-b border-border">
                <AnkiFlowLogo size="sm" />
                <button
                    type="button"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Open navigation menu"
                    className="p-2 rounded-[8px] text-slate-600 hover:bg-[#F0F0EC] hover:text-ink focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-bg"
                >
                    <Menu className="w-5 h-5" />
                </button>
            </header>

            {/* Mobile drawer backdrop */}
            {mobileOpen && (
                <div
                    className="md:hidden fixed inset-0 z-40 bg-ink/40"
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar / drawer */}
            <aside
                className={cn(
                    'w-[240px] h-screen bg-surface flex flex-col px-3 py-[18px] fixed left-0 top-0 z-50 border-r border-border',
                    'transition-transform duration-200 md:translate-x-0',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full',
                )}
                {...verifyAttrs({ unit: 'NavigationSidebar', pathname, mobileOpen })}
            >
                <div className="px-2 pt-[2px] pb-[18px] flex items-center justify-between">
                    <AnkiFlowLogo />
                    <button
                        type="button"
                        onClick={() => setMobileOpen(false)}
                        aria-label="Close navigation menu"
                        className="md:hidden p-2 -mr-2 rounded-[8px] text-slate-600 hover:bg-[#F0F0EC] hover:text-ink focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-bg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <span className="px-2.5 pb-1.5 text-[9px] font-semibold tracking-[0.1em] uppercase font-mono text-[#aeb0b7]">
                    Menu
                </span>

                {nav}

                {/* Bottom: Anki status + User */}
                <div className="mt-auto flex flex-col gap-2">
                    <ConnectedBadge
                        unsyncedCount={unsyncedCount}
                        onSync={handleSync}
                        isSyncing={isSyncing}
                        syncResult={syncResult}
                    />
                    {user?.email && (
                        <div className="flex items-center gap-2.5 px-1.5">
                            <div className="w-[26px] h-[26px] rounded-full bg-[#e7e4dd] flex items-center justify-center flex-shrink-0">
                                <span className="text-[11px] font-bold text-slate-600">
                                    {user.email.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-[11.5px] font-bold text-ink leading-[1.1] truncate">
                                    {user.email}
                                </span>
                                <span className="text-[10.5px] text-slate-400">Personal workspace</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleSignOut}
                                disabled={signingOut}
                                aria-label="Sign out"
                                title="Sign out"
                                className="p-1.5 rounded-[7px] text-slate-400 hover:text-danger hover:bg-danger-bg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
