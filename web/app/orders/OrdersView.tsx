"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type OrderRow = {
  id: string;
  user_id: string;
  prescription_no: string;
  status: string;
  created_at: string;
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
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .select(
        `
          id,
          user_id,
          prescription_no,
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
        `
      )
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      const baseOrders = (data || []) as unknown as OrderRow[];

      const userIds = Array.from(
        new Set(
          baseOrders
            .map((o) => o.user_id)
            .filter((id) => typeof id === "string" && id.length > 0)
        )
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

          setOrders(enriched);
        } else {
          setOrders(baseOrders);
        }
      } else {
        setOrders(baseOrders);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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
          void fetchOrders();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    const { error } = await (supabase as any)
      .from("orders")
      .update({ status })
      .eq("id", id);

    if (error) {
      setError(error.message);
    } else {
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status } : o))
      );
    }

    setUpdatingId(null);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onSignOut();
  };

  return (
    <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-emerald-400">
            Gelen Siparişler
          </h2>
          <p className="text-xs text-slate-300">
            Reçete numarasına göre mobil uygulamadan gelen siparişler.
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600"
        >
          Çıkış Yap
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2 mb-3">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-slate-300 text-sm">Siparişler yükleniyor...</p>
      ) : orders.length === 0 ? (
        <p className="text-slate-300 text-sm">
          Henüz hiç sipariş yok. Mobil uygulamadan verilen siparişler burada
          görünecek.
        </p>
      ) : (
        <div className="mt-2 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          {orders.map((order) => (
            <div
              key={order.id}
              className="border border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between bg-slate-950/40"
            >
              <div>
                <p className="text-sm font-semibold text-slate-50">
                  Reçete No:{" "}
                  <span className="font-mono">{order.prescription_no}</span>
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  Hasta:{" "}
                  <span className="font-semibold">
                    {order.customer_name || "İsim yok"}
                  </span>
                  {order.customer_phone && (
                    <span className="ml-2 text-slate-400">
                      ({order.customer_phone})
                    </span>
                  )}
                </p>
                {order.addresses && (
                  <p className="text-xs text-slate-400 mt-1">
                    Adres:{" "}
                    {order.addresses.formatted_address ||
                      `${order.addresses.neighborhood ?? ""} ${
                        order.addresses.street ?? ""
                      } No:${order.addresses.building_no ?? ""} ${
                        order.addresses.district ?? ""
                      }/${order.addresses.city ?? ""}`}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(order.created_at).toLocaleString("tr-TR")}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Durum:{" "}
                  <span className="font-semibold text-emerald-300">
                    {order.status}
                  </span>
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => updateStatus(order.id, "approved")}
                  disabled={updatingId === order.id}
                  className="px-3 py-1 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold disabled:opacity-50"
                >
                  Onayla
                </button>
                <button
                  onClick={() => updateStatus(order.id, "rejected")}
                  disabled={updatingId === order.id}
                  className="px-3 py-1 text-xs rounded-lg bg-red-500 hover:bg-red-400 text-slate-950 font-semibold disabled:opacity-50"
                >
                  Reddet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
