"use client";

export type Stats = {
  pending: number;
  approved: number;
  rejected: number;
};

export type PharmacyInfo = {
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  district: string | null;
} | null;

type OrdersHeaderProps = {
  pharmacyInfo: PharmacyInfo;
  stats: Stats;
  onMenuToggle: () => void;
};

export function OrdersHeader({
  pharmacyInfo,
  stats,
  onMenuToggle,
}: OrdersHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-slate-50/90 backdrop-blur-sm px-4 sm:px-6 py-3 sm:py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Sol: Hamburger + eczane bilgileri */}
        <div className="flex items-center gap-3">
          {/* Hamburger - sadece mobil */}
          <button
            type="button"
            onClick={onMenuToggle}
            className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>

          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">
              Eczane Bilgileri
            </p>
            <h2 className="text-base sm:text-xl font-semibold text-slate-900 truncate">
              {pharmacyInfo?.name ?? "Eczane"}
            </h2>
            <div className="mt-0.5 sm:mt-1 flex flex-wrap gap-2 sm:gap-3 text-[11px] sm:text-xs text-slate-700">
              {pharmacyInfo?.email && (
                <span className="truncate max-w-[180px] sm:max-w-none">
                  {pharmacyInfo.email}
                </span>
              )}
              {pharmacyInfo?.phone && (
                <span className="text-slate-500">{pharmacyInfo.phone}</span>
              )}
              {(pharmacyInfo?.city || pharmacyInfo?.district) && (
                <span className="text-slate-500">
                  {pharmacyInfo?.city ?? ""}{" "}
                  {pharmacyInfo?.district ? `/ ${pharmacyInfo.district}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sağ: İstatistikler */}
        <div className="flex gap-2 sm:gap-3 text-xs text-slate-600">
          <div className="flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-slate-200 bg-slate-100">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-wide">
              Bekleyen
            </p>
            <p className="mt-0.5 text-base sm:text-lg font-semibold text-amber-500">
              {stats.pending}
            </p>
          </div>
          <div className="flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-slate-200 bg-slate-100">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-wide">
              Onaylanan
            </p>
            <p className="mt-0.5 text-base sm:text-lg font-semibold text-emerald-500">
              {stats.approved}
            </p>
          </div>
          <div className="flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-slate-200 bg-slate-100">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-wide">
              Reddedilen
            </p>
            <p className="mt-0.5 text-base sm:text-lg font-semibold text-rose-500">
              {stats.rejected}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
