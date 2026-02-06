"use client";

import { useEffect, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { OrdersSidebar } from "../../components/OrdersSidebar";
import {
  OrdersHeader,
  type Stats,
  type PharmacyInfo,
} from "../../components/OrdersHeader";

type OrderRow = {
  id: string;
  user_id: string;
  prescription_no: string;
  status: string;
  created_at: string;
  note?: string | null;
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
          event: "*",
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
  }, [refetch]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("orders")
        .update({ status })
        .eq("id", id);

      if (error) {
        throw new Error(error.message);
      }
    },
    onMutate: ({ id }) => {
      setUpdatingId(id);
      setError(null);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Durum güncellenirken hata oluştu";
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

  const visibleOrders =
    statusFilter === "all"
      ? orders
      : orders.filter((o) => o.status === statusFilter);

  const stats = {
    pending: orders.filter((o: OrderRow) => o.status === "pending").length,
    approved: orders.filter((o: OrderRow) => o.status === "approved").length,
    rejected: orders.filter((o: OrderRow) => o.status === "rejected").length,
  };

  const selectedOrder: OrderRow | null =
    selectedOrderId != null
      ? orders.find((o: OrderRow) => o.id === selectedOrderId) ?? null
      : null;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <OrdersSidebar onSignOut={handleSignOut} />

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        <OrdersHeader pharmacyInfo={pharmacyInfo} stats={stats} />

        {/* Filtre + durum/tablolar */}
        {!isLoading && !error && visibleOrders.length === 0 && (
          <section className="flex-1 px-6 py-4 overflow-y-auto">
            <p className="text-sm text-slate-600">
              Seçili filtreye uygun sipariş bulunamadı. Mobil uygulamadan
              verilen siparişler burada görünecek.
            </p>
          </section>
        )}

        {!isLoading && !error && visibleOrders.length > 0 && (
          <section className="flex-1 px-6 py-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Gelen Siparişler
                </h3>
                <p className="text-xs text-slate-500">
                  Reçete numarasına göre mobil uygulamadan gelen siparişler.
                </p>
              </div>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as typeof statusFilter)
                }
                className="text-xs px-2 py-1 rounded-lg border bg-slate-100 border-slate-300 text-slate-800"
              >
                <option value="all">Tümü</option>
                <option value="pending">Bekleyen</option>
                <option value="approved">Onaylanan</option>
                <option value="rejected">Reddedilen</option>
              </select>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                {error}
              </p>
            )}

            <div className="mt-2 border border-slate-200 bg-white rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1.1fr,0.9fr,1fr,2fr,1fr,1.2fr] gap-3 px-4 py-2 text-[11px] font-medium border-b text-slate-600 bg-slate-100 border-slate-200">
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
                    <div className="flex items-center">
                      <span className="inline-flex px-2 py-1 rounded-md font-mono text-[12px] bg-slate-100 text-slate-900 border border-slate-200">
                        {order.prescription_no}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-slate-700">
                        {order.customer_phone || "-"}
                      </span>
                    </div>
                    <div className="flex items-center">
                      {order.addresses && (
                        <p className="text-slate-700">
                          {order.addresses.formatted_address ||
                            `${order.addresses.neighborhood ?? ""} ${
                              order.addresses.street ?? ""
                            } No:${order.addresses.building_no ?? ""} ${
                              order.addresses.district ?? ""
                            }/${order.addresses.city ?? ""}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-[11px] font-medium ${
                          order.status === "approved"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : order.status === "rejected"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {order.status === "approved"
                          ? "Onaylandı"
                          : order.status === "rejected"
                          ? "Reddedildi"
                          : "Bekliyor"}
                      </span>
                    </div>
                    <div className="flex items-center justify-end text-[11px] text-slate-400">
                      <span className="hidden md:inline">Detayı Gör</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Gelişmiş sipariş detayı */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setSelectedOrderId(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl px-6 py-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Sipariş Detayı
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {selectedOrder.customer_name || "İsim yok"}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md font-mono text-[12px] bg-slate-100 text-slate-900 border border-slate-200">
                    <span className="font-semibold">Reçete No:</span>
                    {selectedOrder.prescription_no}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {new Date(selectedOrder.created_at).toLocaleString("tr-TR")}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span
                  className={`inline-flex px-3 py-1 rounded-full text-[11px] font-medium ${
                    selectedOrder.status === "approved"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : selectedOrder.status === "rejected"
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {selectedOrder.status === "approved"
                    ? "Onaylandı"
                    : selectedOrder.status === "rejected"
                      ? "Reddedildi"
                      : "Bekliyor"}
                </span>
                <button
                  onClick={() => setSelectedOrderId(null)}
                  className="mt-1 text-xs px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Kapat
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
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

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide mb-1 text-slate-500">
                  Reçete / Not
                </p>
                <p className="font-mono text-[13px] text-slate-900">
                  {selectedOrder.prescription_no}
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  {selectedOrder.note
                    ? `Not: ${selectedOrder.note}`
                    : "Herhangi bir not eklenmemiş."}
                </p>
              </div>

              <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide mb-1 text-slate-500">
                  Teslimat Adresi
                </p>
                {selectedOrder.addresses ? (
                  <p className="text-slate-700">
                    {selectedOrder.addresses.formatted_address ||
                      `${selectedOrder.addresses.neighborhood ?? ""} ${
                        selectedOrder.addresses.street ?? ""
                      } No:${selectedOrder.addresses.building_no ?? ""} ${
                        selectedOrder.addresses.district ?? ""
                      }/${selectedOrder.addresses.city ?? ""}`}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Adres bilgisi bulunamadı.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Bu ekrandan siparişi onaylayabilir veya reddedebilirsiniz.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateStatus(selectedOrder.id, "rejected")}
                  disabled={updatingId === selectedOrder.id}
                  className="px-4 py-2 text-xs rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-semibold disabled:opacity-50"
                >
                  Reddet
                </button>
                <button
                  onClick={() => updateStatus(selectedOrder.id, "approved")}
                  disabled={updatingId === selectedOrder.id}
                  className="px-4 py-2 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold disabled:opacity-50"
                >
                  Onayla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
