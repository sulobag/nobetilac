"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import {
  OrdersSidebar,
  type SidebarView,
} from "../../components/OrdersSidebar";
import {
  OrdersHeader,
  type Stats,
  type PharmacyInfo,
} from "../../components/OrdersHeader";
import { ToastContainer, useToast } from "../../components/Toast";

type OrderRow = {
  id: string;
  user_id: string;
  prescription_no: string;
  status: string;
  created_at: string;
  note?: string | null;
  prescription_image_path?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  addresses?: {
    formatted_address?: string | null;
    city?: string | null;
    district?: string | null;
    neighborhood?: string | null;
    street?: string | null;
    building_no?: string | null;
  } | null;
};

interface Props {
  onSignOut: () => void;
}

export default function OrdersView({ onSignOut }: Props) {
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarView, setSidebarView] = useState<SidebarView>("active");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [pharmacyInfo, setPharmacyInfo] = useState<{
    name: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    district: string | null;
  } | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [imageLightboxUrl, setImageLightboxUrl] = useState<string | null>(null);
  const { messages: toastMessages, addToast, dismissToast } = useToast();

  // Ses ve bildirim altyapısı
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevOrderIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    audioRef.current = new Audio("/pharmacy_notify_sound.wav");
    audioRef.current.volume = 1;

    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission();
    }
  }, []);

  const playNotification = useCallback(
    (customerName: string) => {
      try {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          void audioRef.current.play().catch(() => {});
        }
      } catch {
        /* ses çalınmazsa sessizce devam et */
      }

      addToast({
        title: "Yeni Sipariş Geldi!",
        body: `${customerName || "Bir müşteri"} yeni bir sipariş oluşturdu.`,
        type: "info",
      });

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification("Yeni Sipariş Geldi!", {
          body: `${customerName || "Bir müşteri"} yeni bir sipariş oluşturdu.`,
          icon: "/favicon.ico",
        });
      }
    },
    [addToast],
  );

  const {
    data: orders = [],
    isLoading,
    refetch,
  }: UseQueryResult<OrderRow[], Error> = useQuery<OrderRow[], Error>({
    queryKey: ["pharmacy-orders"],
    queryFn: async () => {
      setError(null);

      const { data, error: userError } = await supabase.auth.getUser();

      if (userError || !data.user) {
        throw new Error("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
      }

      const { data: pharmacy, error: pharmacyError } = await supabase
        .from("pharmacies")
        .select("id,name,email,phone,city,district")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (pharmacyError) {
        throw new Error("Eczane bilgisi alınırken bir hata oluştu.");
      }

      if (!pharmacy) {
        throw new Error(
          "Bu panel yalnızca eczane hesabı olan kullanıcılar içindir. Lütfen önce kayıt olun.",
        );
      }

      setPharmacyInfo({
        name: (pharmacy as any).name ?? null,
        email: (pharmacy as any).email ?? null,
        phone: (pharmacy as any).phone ?? null,
        city: (pharmacy as any).city ?? null,
        district: (pharmacy as any).district ?? null,
      });

      const { data: orderData, error } = await supabase
        .from("orders")
        .select(
          `
            id,
            user_id,
            prescription_no,
            prescription_image_path,
            note,
            status,
            created_at,
            addresses (
              formatted_address,
              city,
              district,
              neighborhood,
              street,
              building_no
            )
          `,
        )
        .eq("pharmacy_id", (pharmacy as any).id)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      const baseOrders = (orderData || []) as unknown as OrderRow[];

      const userIds = Array.from(
        new Set(
          baseOrders
            .map((o) => o.user_id)
            .filter((id) => typeof id === "string" && id.length > 0),
        ),
      );

      if (userIds.length > 0) {
        const { data: userRows, error: usersError } = await supabase
          .from("users")
          .select("id,full_name,phone")
          .in("id", userIds);

        if (!usersError && userRows) {
          const userMap = new Map<
            string,
            { full_name: string | null; phone: string | null }
          >();

          for (const u of userRows as any[]) {
            userMap.set(u.id, {
              full_name: (u as any).full_name ?? null,
              phone: (u as any).phone ?? null,
            });
          }

          const enriched = baseOrders.map((o) => {
            const info = userMap.get(o.user_id);
            return {
              ...o,
              customer_name: info?.full_name ?? null,
              customer_phone: info?.phone ?? null,
            };
          });

          return enriched;
        }
      }
      return baseOrders;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("orders_stream_pharmacy")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        (payload: any) => {
          void refetch().then(() => {
            const newId = payload?.new?.id;
            if (newId && !prevOrderIdsRef.current.has(newId)) {
              playNotification(payload?.new?.customer_name || "");
            }
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
        },
        () => {
          void refetch();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refetch, playNotification]);

  useEffect(() => {
    if (orders.length > 0) {
      prevOrderIdsRef.current = new Set(orders.map((o: OrderRow) => o.id));
    }
  }, [orders]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      setAccessToken(data.session?.access_token ?? null);
    })();
  }, []);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("orders")
        .update({ status })
        .eq("id", id);

      if (error) {
        throw new Error(error.message);
      }

      if (status === "approved" || status === "rejected") {
        try {
          const currentToken = accessToken;
          if (currentToken) {
            await fetch("/api/send-push", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: id,
                status,
                token: currentToken,
              }),
            });
          }
        } catch {
          // Push gönderilemezse sessizce devam et
        }
      }
    },
    onMutate: ({ id }) => {
      setUpdatingId(id);
      setError(null);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : "Durum güncellenirken hata oluştu";
      setError(msg);
      setUpdatingId(null);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      setUpdatingId(null);
    },
  });

  const updateStatus = (id: string, status: string) => {
    updateStatusMutation.mutate({ id, status });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onSignOut();
  };

  const pendingOrders = orders.filter(
    (o: OrderRow) => o.status === "pending",
  );
  const visibleOrders =
    statusFilter === "all"
      ? orders
      : orders.filter((o) => o.status === statusFilter);

  const stats = {
    pending: pendingOrders.length,
    approved: orders.filter((o: OrderRow) => o.status === "approved").length,
    rejected: orders.filter((o: OrderRow) => o.status === "rejected").length,
  };

  const selectedOrder: OrderRow | null =
    selectedOrderId != null
      ? orders.find((o: OrderRow) => o.id === selectedOrderId) ?? null
      : null;

  const formatAddress = (addr: OrderRow["addresses"]) => {
    if (!addr) return "-";
    return (
      addr.formatted_address ||
      `${addr.neighborhood ?? ""} ${addr.street ?? ""} No:${addr.building_no ?? ""} ${addr.district ?? ""}/${addr.city ?? ""}`
    );
  };

  const timeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Az önce";
    if (mins < 60) return `${mins} dk önce`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} saat önce`;
    return `${Math.floor(hours / 24)} gün önce`;
  };

  const statusBadge = (status: string) => {
    const cls =
      status === "approved"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : status === "rejected"
          ? "bg-rose-50 text-rose-700 border-rose-200"
          : "bg-amber-50 text-amber-700 border-amber-200";
    const label =
      status === "approved"
        ? "Onaylandı"
        : status === "rejected"
          ? "Reddedildi"
          : "Bekliyor";
    return (
      <span
        className={`inline-flex px-2 py-1 rounded-full text-[11px] font-medium border ${cls}`}
      >
        {label}
      </span>
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <ToastContainer messages={toastMessages} onDismiss={dismissToast} />

      <OrdersSidebar
        onSignOut={handleSignOut}
        currentView={sidebarView}
        onViewChange={setSidebarView}
        pendingCount={pendingOrders.length}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((p) => !p)}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <OrdersHeader
          pharmacyInfo={pharmacyInfo}
          stats={stats}
          onMenuToggle={() => setSidebarOpen((p) => !p)}
        />

        {error && (
          <div className="px-4 sm:px-6 pt-4">
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          </div>
        )}

        {/* ── AKTİF SİPARİŞLER GÖRÜNÜMÜ ── */}
        {sidebarView === "active" && (
          <section className="flex-1 px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-slate-900">
                Aktif Siparişler
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Onay bekleyen siparişler. Hızlıca onaylayın veya reddedin.
              </p>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!isLoading && pendingOrders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                  <svg
                    className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-700">
                  Bekleyen sipariş yok
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Tüm siparişler işlenmiş. Yeni siparişler burada görünecek.
                </p>
              </div>
            )}

            {!isLoading && pendingOrders.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {pendingOrders.map((order: OrderRow) => (
                  <div
                    key={order.id}
                    className="group relative bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all overflow-hidden"
                  >
                    {/* Üst kısım */}
                    <div className="px-3.5 sm:px-4 pt-3.5 sm:pt-4 pb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                        </span>
                        <span className="text-[11px] font-medium text-amber-600">
                          Onay Bekliyor
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {timeSince(order.created_at)}
                      </span>
                    </div>

                    {/* Hasta bilgileri */}
                    <div className="px-3.5 sm:px-4 pb-2 sm:pb-3">
                      <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                        {order.customer_name || "İsim yok"}
                      </h4>
                      {order.customer_phone && (
                        <p className="text-[12px] text-slate-500 font-mono mt-0.5">
                          {order.customer_phone}
                        </p>
                      )}
                    </div>

                    {/* Reçete + adres */}
                    <div className="px-3.5 sm:px-4 pb-3 space-y-1.5 sm:space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 w-14 sm:w-16 shrink-0">
                          Reçete:
                        </span>
                        <span className="inline-flex px-2 py-0.5 rounded-md font-mono text-[12px] bg-slate-100 text-slate-800 border border-slate-200 truncate">
                          {order.prescription_no || "-"}
                        </span>
                        {order.prescription_image_path && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            📷
                          </span>
                        )}
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-[11px] text-slate-500 w-14 sm:w-16 shrink-0 pt-0.5">
                          Adres:
                        </span>
                        <p className="text-[12px] text-slate-600 leading-relaxed line-clamp-2">
                          {formatAddress(order.addresses)}
                        </p>
                      </div>
                      {order.note && (
                        <div className="flex items-start gap-2">
                          <span className="text-[11px] text-slate-500 w-14 sm:w-16 shrink-0 pt-0.5">
                            Not:
                          </span>
                          <p className="text-[12px] text-slate-600 italic leading-relaxed line-clamp-2">
                            {order.note}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Alt butonlar */}
                    <div className="flex border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSelectedOrderId(order.id)}
                        className="flex-1 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors border-r border-slate-100"
                      >
                        Detay
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(order.id, "rejected")}
                        disabled={updatingId === order.id}
                        className="flex-1 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors border-r border-slate-100 disabled:opacity-50"
                      >
                        Reddet
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(order.id, "approved")}
                        disabled={updatingId === order.id}
                        className="flex-1 py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                      >
                        Onayla
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── TÜM SİPARİŞLER GÖRÜNÜMÜ ── */}
        {sidebarView === "all" && (
          <section className="flex-1 px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Tüm Siparişler
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Geçmiş ve mevcut tüm siparişlerin listesi.
                </p>
              </div>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as typeof statusFilter)
                }
                className="text-xs px-3 py-1.5 rounded-lg border bg-white border-slate-300 text-slate-800 shadow-sm self-start sm:self-auto"
              >
                <option value="all">Tümü ({orders.length})</option>
                <option value="pending">Bekleyen ({stats.pending})</option>
                <option value="approved">Onaylanan ({stats.approved})</option>
                <option value="rejected">Reddedilen ({stats.rejected})</option>
              </select>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!isLoading && visibleOrders.length === 0 && (
              <p className="text-sm text-slate-500 py-10 text-center">
                Seçili filtreye uygun sipariş bulunamadı.
              </p>
            )}

            {/* Masaüstü: Tablo görünümü */}
            {!isLoading && visibleOrders.length > 0 && (
              <>
                <div className="hidden lg:block border border-slate-200 bg-white rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[1.1fr,0.9fr,1fr,2fr,1fr,1.2fr] gap-3 px-4 py-2.5 text-[11px] font-medium border-b text-slate-600 bg-slate-100 border-slate-200">
                    <span>Hasta</span>
                    <span>Reçete No</span>
                    <span>Telefon</span>
                    <span>Adres</span>
                    <span>Durum</span>
                    <span className="text-right">Aksiyonlar</span>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto">
                    {visibleOrders.map((order: OrderRow) => (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => setSelectedOrderId(order.id)}
                        className="w-full text-left grid grid-cols-[1.1fr,0.9fr,1fr,2fr,1fr,1.2fr] gap-3 px-4 py-3 text-xs border-b last:border-b-0 cursor-pointer transition-colors text-slate-800 border-slate-100 hover:bg-slate-50"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {order.customer_name || "İsim yok"}
                          </p>
                          {order.note && (
                            <p className="mt-1 text-[11px] italic text-slate-500">
                              Not: {order.note}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-slate-500">
                            {new Date(order.created_at).toLocaleString("tr-TR")}
                          </p>
                        </div>
                        <div className="flex flex-col justify-center gap-1">
                          <span className="inline-flex px-2 py-1 rounded-md font-mono text-[12px] bg-slate-100 text-slate-900 border border-slate-200">
                            {order.prescription_no || "-"}
                          </span>
                          {order.prescription_image_path && (
                            <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Fotoğraf var
                            </span>
                          )}
                        </div>
                        <div className="flex items-center">
                          <span className="text-slate-700">
                            {order.customer_phone || "-"}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <p className="text-slate-700 line-clamp-2">
                            {formatAddress(order.addresses)}
                          </p>
                        </div>
                        <div className="flex items-center">
                          {statusBadge(order.status)}
                        </div>
                        <div className="flex items-center justify-end text-[11px] text-slate-400">
                          <span>Detayı Gör →</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobil: Kart görünümü */}
                <div className="lg:hidden space-y-3">
                  {visibleOrders.map((order: OrderRow) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setSelectedOrderId(order.id)}
                      className="w-full text-left bg-white rounded-xl border border-slate-200 p-3.5 hover:border-slate-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {order.customer_name || "İsim yok"}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {new Date(order.created_at).toLocaleString("tr-TR")}
                          </p>
                        </div>
                        {statusBadge(order.status)}
                      </div>

                      <div className="space-y-1.5 text-[12px]">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-16 shrink-0">
                            Reçete:
                          </span>
                          <span className="font-mono text-slate-800 truncate">
                            {order.prescription_no || "-"}
                          </span>
                          {order.prescription_image_path && (
                            <span className="text-[10px] text-emerald-700 shrink-0">
                              📷
                            </span>
                          )}
                        </div>
                        {order.customer_phone && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 w-16 shrink-0">
                              Telefon:
                            </span>
                            <span className="font-mono text-slate-700">
                              {order.customer_phone}
                            </span>
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <span className="text-slate-500 w-16 shrink-0 pt-0.5">
                            Adres:
                          </span>
                          <p className="text-slate-600 line-clamp-2">
                            {formatAddress(order.addresses)}
                          </p>
                        </div>
                        {order.note && (
                          <div className="flex items-start gap-2">
                            <span className="text-slate-500 w-16 shrink-0 pt-0.5">
                              Not:
                            </span>
                            <p className="text-slate-600 italic line-clamp-1">
                              {order.note}
                            </p>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      {/* Gelişmiş sipariş detayı */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setSelectedOrderId(null)}
        >
          <div
            className="w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl px-4 sm:px-6 py-4 sm:py-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 sm:gap-4 mb-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Sipariş Detayı
                </p>
                <h2 className="mt-1 text-lg sm:text-xl font-semibold truncate">
                  {selectedOrder.customer_name || "İsim yok"}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 rounded-md font-mono text-[11px] sm:text-[12px] bg-slate-100 text-slate-900 border border-slate-200">
                    <span className="font-semibold">Reçete:</span>
                    <span className="truncate max-w-[120px] sm:max-w-none">
                      {selectedOrder.prescription_no}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {new Date(selectedOrder.created_at).toLocaleString("tr-TR")}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                {statusBadge(selectedOrder.status)}
                <button
                  onClick={() => setSelectedOrderId(null)}
                  className="mt-1 text-xs px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Kapat
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm mb-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide mb-1 text-slate-500">
                  Hasta Bilgileri
                </p>
                <p className="font-semibold">
                  {selectedOrder.customer_name || "İsim yok"}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Telefon:{" "}
                  <span className="font-mono">
                    {selectedOrder.customer_phone || "-"}
                  </span>
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide mb-1 text-slate-500">
                  Reçete / Not
                </p>
                <p className="font-mono text-[13px] text-slate-900 break-all">
                  {selectedOrder.prescription_no || "-"}
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  {selectedOrder.note
                    ? `Not: ${selectedOrder.note}`
                    : "Herhangi bir not eklenmemiş."}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide mb-1 text-slate-500">
                  Reçete Fotoğrafı
                </p>
                {selectedOrder.prescription_image_path && accessToken ? (
                  <button
                    type="button"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white overflow-hidden max-h-56 sm:max-h-72 flex items-center justify-center hover:bg-slate-50 transition-colors"
                    onClick={() =>
                      setImageLightboxUrl(
                        `/api/prescription-image?orderId=${selectedOrder.id}&token=${encodeURIComponent(
                          accessToken,
                        )}`,
                      )
                    }
                  >
                    <img
                      src={`/api/prescription-image?orderId=${selectedOrder.id}&token=${encodeURIComponent(
                        accessToken,
                      )}`}
                      alt="Reçete fotoğrafı"
                      className="max-h-56 sm:max-h-72 w-auto object-contain"
                    />
                  </button>
                ) : (
                  <p className="text-xs text-slate-500">
                    Bu sipariş için reçete fotoğrafı eklenmemiş.
                  </p>
                )}
              </div>

              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide mb-1 text-slate-500">
                  Teslimat Adresi
                </p>
                {selectedOrder.addresses ? (
                  <p className="text-slate-700 text-sm">
                    {formatAddress(selectedOrder.addresses)}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Adres bilgisi bulunamadı.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Bu ekrandan siparişi onaylayabilir veya reddedebilirsiniz.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateStatus(selectedOrder.id, "rejected")}
                  disabled={updatingId === selectedOrder.id}
                  className="flex-1 sm:flex-initial px-4 py-2 text-xs rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold disabled:opacity-50"
                >
                  Reddet
                </button>
                <button
                  onClick={() => updateStatus(selectedOrder.id, "approved")}
                  disabled={updatingId === selectedOrder.id}
                  className="flex-1 sm:flex-initial px-4 py-2 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold disabled:opacity-50"
                >
                  Onayla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reçete fotoğrafı lightbox */}
      {imageLightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
          onClick={() => setImageLightboxUrl(null)}
        >
          <div
            className="w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white">
                Reçete Fotoğrafı
              </p>
              <button
                type="button"
                onClick={() => setImageLightboxUrl(null)}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
              >
                Kapat
              </button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden flex items-center justify-center">
              <img
                src={imageLightboxUrl}
                alt="Reçete fotoğrafı"
                className="max-h-[80vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
