"use client";

type OrdersSidebarProps = {
  onSignOut: () => void;
};

export function OrdersSidebar({ onSignOut }: OrdersSidebarProps) {
  return (
    <aside className="w-60 border-r border-slate-200 bg-white flex flex-col">
      <div className="px-4 py-5 border-b border-slate-200 bg-white">
        <h1 className="text-lg font-semibold text-emerald-600 tracking-tight">
          Eczane Panel
        </h1>
        <p className="text-[11px] mt-1 text-slate-500">
          Nöbetçi sipariş yönetimi
        </p>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1 text-sm bg-white">
        {/* Aktif item */}
        <button className="group w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-400 text-slate-50 shadow-sm">
          <span className="w-1 h-8 rounded-full bg-emerald-400" />
          <span className="text-[13px] font-medium tracking-wide">
            Siparişler
          </span>
        </button>

        {/* Pasif item */}
        <button className="group w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors">
          <span className="w-1 h-8 rounded-full bg-slate-300 group-hover:bg-slate-500 transition-colors" />
          <span className="text-[13px] font-medium tracking-wide">Profil</span>
        </button>
      </nav>
      <div className="px-3 py-4 border-t border-slate-200 bg-white">
        <button
          onClick={onSignOut}
          className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition-colors flex items-center justify-between"
        >
          <span>Çıkış Yap</span>
          <span className="w-6 h-6 rounded-full bg-slate-900 text-slate-50 flex items-center justify-center text-[10px]">
            N
          </span>
        </button>
      </div>
    </aside>
  );
}
