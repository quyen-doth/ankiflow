import { cn } from '@/lib/utils';

export type Tone = 'green' | 'amber';

const HEADER_TONE: Record<Tone, string> = {
    green: 'text-primary bg-[rgba(49,99,66,0.1)]',
    amber: 'text-[#b87514] bg-[rgba(184,117,20,0.1)]',
};

const ICON_TONE: Record<Tone, string> = {
    green: 'text-primary bg-[rgba(49,99,66,0.08)]',
    amber: 'text-[#b87514] bg-[rgba(184,117,20,0.08)]',
};

export function SectionHeader({ icon: Icon, label, tone }: { icon: React.ElementType; label: string; tone: Tone }) {
    return (
        <div className="flex items-center gap-2 mb-[18px]">
            <span
                className={cn(
                    'w-[26px] h-[26px] rounded-[7px] flex items-center justify-center flex-shrink-0',
                    HEADER_TONE[tone],
                )}
            >
                <Icon className="w-[15px] h-[15px]" />
            </span>
            <span className="text-[12px] font-bold tracking-[0.05em] uppercase font-mono text-slate-600">{label}</span>
        </div>
    );
}

interface IntegrationCardProps {
    label: string;
    description: string;
    icon: React.ElementType;
    tone: Tone;
    descMono?: boolean;
    connected: boolean;
    checking: boolean;
}

export function IntegrationCard({
    label,
    description,
    icon: Icon,
    tone,
    descMono,
    connected,
    checking,
}: IntegrationCardProps) {
    return (
        <div className="flex items-center gap-3.5 p-[14px] border border-[#eceae4] rounded-[11px]">
            <span
                className={cn(
                    'w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0',
                    ICON_TONE[tone],
                )}
            >
                <Icon className="w-[18px] h-[18px]" />
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-ink">{label}</p>
                <p className={cn('text-[12.5px] text-slate-400 truncate', descMono && 'font-mono')}>{description}</p>
            </div>
            {checking ? (
                <span className="inline-flex items-center text-[12px] font-bold text-slate-400 bg-canvas px-3 py-1.5 rounded-full">
                    Checking…
                </span>
            ) : (
                <span
                    className={cn(
                        'inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full',
                        connected ? 'bg-[rgba(49,99,66,0.08)] text-primary' : 'bg-danger-bg text-danger',
                    )}
                >
                    <span className={cn('w-1.5 h-1.5 rounded-full', connected ? 'bg-primary' : 'bg-danger')} />
                    {connected ? 'Connected' : 'Offline'}
                </span>
            )}
        </div>
    );
}
