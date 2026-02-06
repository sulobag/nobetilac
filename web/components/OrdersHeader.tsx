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
};

export function OrdersHeader({
  pharmacyInfo,
  stats,
}: OrdersHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-slate-50/90 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Eczane Bilgileri
        </p>
        <h2 className="text-xl font-semibold text-slate-900">
          {pharmacyInfo?.name ?? "Eczane"}
        </h2>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-700">
          {pharmacyInfo?.email && <span>{pharmacyInfo.email}</span>}
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
      <div className="flex items-center gap-4">
        <div className="flex gap-3 text-xs text-slate-600">
          <div className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-100">
            <p className="text-[11px] uppercase tracking-wide">
              Bekleyen Sipariş
            </p>
            <p className="mt-1 text-lg font-semibold text-amber-300">
              {stats.pending}
            </p>
          </div>
          <div className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-100">
            <p className="text-[11px] uppercase tracking-wide">Onaylanan</p>
            <p className="mt-1 text-lg font-semibold text-emerald-300">
              {stats.approved}
            </p>
          </div>
          <div className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-100">
            <p className="text-[11px] uppercase tracking-wide">Reddedilen</p>
            <p className="mt-1 text-lg font-semibold text-rose-300">
              {stats.rejected}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

