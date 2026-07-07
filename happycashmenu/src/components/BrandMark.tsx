type BrandMarkProps = {
  name?: string;
  logoUrl?: string | null;
  compact?: boolean;
};

export function BrandMark({ name = "HappyCash Menu", logoUrl, compact = false }: BrandMarkProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {logoUrl ? (
        <img src={logoUrl} alt={name} className="size-12 rounded-[18px] object-cover ring-1 ring-black/10" />
      ) : (
        <div className="grid size-12 place-items-center rounded-[18px] bg-primary text-base font-extrabold text-primary-foreground shadow-[0_14px_32px_rgba(255,124,32,0.22)]">
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold leading-tight tracking-[-0.02em]">{name}</p>
        {!compact ? <p className="text-xs font-bold text-muted-foreground">por HappyCashFood</p> : null}
      </div>
    </div>
  );
}
