"use client";

export type SidebarView = "active" | "all";

type OrdersSidebarProps = {
  onSignOut: () => void;
  currentView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  pendingCount: number;
  isOpen: boolean;
  onToggle: () => void;
};

export function OrdersSidebar({
  onSignOut,
  currentView,
  onViewChange,
  pendingCount,
  isOpen,
  onToggle,
}: OrdersSidebarProps) {
  const handleNavClick = (view: SidebarView) => {
    onViewChange(view);
    // Mobilde tıklanınca kapat
    onToggle();
  };

  return (
    <>
      {/* Mobil overlay arkaplan */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0 lg:w-60
        `}
      >
        <div className="px-4 py-5 border-b border-slate-200 bg-white flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-emerald-600 tracking-tight">
              Eczane Panel
            </h1>
            <p className="text-[11px] mt-1 text-slate-500">
              Nöbetçi sipariş yönetimi
            </p>
          </div>
          {/* Mobil kapat butonu */}
          <button
            type="button"
            onClick={onToggle}
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1 text-sm bg-white">
          {/* Aktif Siparişler */}
          <button
            onClick={() => handleNavClick("active")}
            className={`group w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
              currentView === "active"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span
              className={`w-1 h-8 rounded-full transition-colors ${
                currentView === "active"
                  ? "bg-white/40"
                  : "bg-slate-300 group-hover:bg-slate-500"
              }`}
            />
            <span className="flex-1 text-left text-[13px] font-medium tracking-wide">
              Aktif Siparişler
            </span>
            {pendingCount > 0 && (
              <span
                className={`min-w-[22px] h-[22px] flex items-center justify-center rounded-full text-[11px] font-bold ${
                  currentView === "active"
                    ? "bg-white/20 text-white"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {pendingCount}
              </span>
            )}
          </button>

          {/* Tüm Siparişler */}
          <button
            onClick={() => handleNavClick("all")}
            className={`group w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
              currentView === "all"
                ? "bg-slate-700 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span
              className={`w-1 h-8 rounded-full transition-colors ${
                currentView === "all"
                  ? "bg-white/40"
                  : "bg-slate-300 group-hover:bg-slate-500"
              }`}
            />
            <span className="flex-1 text-left text-[13px] font-medium tracking-wide">
              Tüm Siparişler
            </span>
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
    </>
  );
}
