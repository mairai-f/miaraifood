type BrandMarkProps = {
  name?: string;
  logoUrl?: string | null;
  compact?: boolean;
};

export function BrandMark({ name = "HappyCash Menu", logoUrl, compact = false }: BrandMarkProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {logoUrl ? (
        <img src={logoUrl} alt={name} className="size-11 rounded-lg object-cover ring-1 ring-black/10" />
      ) : (
        <div className="grid size-11 place-items-center rounded-lg bg-primary text-base font-black text-primary-foreground">
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-black leading-tight">{name}</p>
        {!compact ? <p className="text-xs font-bold text-muted-foreground">por HappyCashFood</p> : null}
      </div>
    </div>
  );
}
