export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      addresses: {
        Row: {
          id: string;
          user_id: string;
          title: "Ev" | "İş" | "Diğer";
          custom_title: string | null;
          city: string;
          district: string;
          neighborhood: string;
          street: string;
          building_no: string;
          floor: string | null;
          apartment_no: string | null;
          address_description: string | null;
          latitude: number | null;
          longitude: number | null;
          formatted_address: string | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: "Ev" | "İş" | "Diğer";
          custom_title?: string | null;
          city: string;
          district: string;
          neighborhood: string;
          street: string;
          building_no: string;
          floor?: string | null;
          apartment_no?: string | null;
          address_description?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          formatted_address?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: "Ev" | "İş" | "Diğer";
          custom_title?: string | null;
          city?: string;
          district?: string;
          neighborhood?: string;
          street?: string;
          building_no?: string;
          floor?: string | null;
          apartment_no?: string | null;
          address_description?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          formatted_address?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          phone: string;
          full_name: string;
          role: ("customer" | "courier" | "admin")[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          phone: string;
          full_name: string;
          role?: ("customer" | "courier" | "admin")[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          phone?: string;
          full_name?: string;
          role?: ("customer" | "courier" | "admin")[];
          created_at?: string;
          updated_at?: string;
        };
      };
      couriers: {
        Row: {
          id: string;
          user_id: string;
          vehicle_type: "motorcycle" | "car" | "bicycle" | "scooter";
          is_available: boolean;
          latitude: number | null;
          longitude: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          vehicle_type: "motorcycle" | "car" | "bicycle" | "scooter";
          is_available?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          vehicle_type?: "motorcycle" | "car" | "bicycle" | "scooter";
          is_available?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          order_no: string | null;
          user_id: string;
          pharmacy_id: string;
          address_id: string;
          courier_id: string | null;
          prescription_no: string | null;
          prescription_image_path: string | null;
          status: string;
          note: string | null;
          rejected_courier_ids: string[];
          delivery_code: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_no?: string | null;
          user_id: string;
          pharmacy_id: string;
          address_id: string;
          courier_id?: string | null;
          prescription_no?: string | null;
          prescription_image_path?: string | null;
          status?: string;
          note?: string | null;
          rejected_courier_ids?: string[];
          delivery_code?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_no?: string | null;
          user_id?: string;
          pharmacy_id?: string;
          address_id?: string;
          courier_id?: string | null;
          prescription_no?: string | null;
          prescription_image_path?: string | null;
          status?: string;
          note?: string | null;
          rejected_courier_ids?: string[];
          delivery_code?: string | null;
          created_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          user_id: string;
          pharmacy_id: string | null;
          courier_id: string | null;
          currency: string;
          medicine_price: number;
          delivery_fee: number;
          platform_commission_rate: number;
          platform_commission_amount: number;
          total_price: number;
          status:
            | "draft"
            | "awaiting_payment"
            | "paid"
            | "failed"
            | "cancelled"
            | "refunded";
          iyzico_conversation_id: string | null;
          iyzico_basket_id: string | null;
          iyzico_checkout_token: string | null;
          iyzico_payment_id: string | null;
          iyzico_payment_transaction_id: string | null;
          iyzico_raw: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          user_id: string;
          pharmacy_id?: string | null;
          courier_id?: string | null;
          currency?: string;
          medicine_price: number;
          delivery_fee?: number;
          platform_commission_rate?: number;
          platform_commission_amount: number;
          total_price: number;
          status?:
            | "draft"
            | "awaiting_payment"
            | "paid"
            | "failed"
            | "cancelled"
            | "refunded";
          iyzico_conversation_id?: string | null;
          iyzico_basket_id?: string | null;
          iyzico_checkout_token?: string | null;
          iyzico_payment_id?: string | null;
          iyzico_payment_transaction_id?: string | null;
          iyzico_raw?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          user_id?: string;
          pharmacy_id?: string | null;
          courier_id?: string | null;
          currency?: string;
          medicine_price?: number;
          delivery_fee?: number;
          platform_commission_rate?: number;
          platform_commission_amount?: number;
          total_price?: number;
          status?:
            | "draft"
            | "awaiting_payment"
            | "paid"
            | "failed"
            | "cancelled"
            | "refunded";
          iyzico_conversation_id?: string | null;
          iyzico_basket_id?: string | null;
          iyzico_checkout_token?: string | null;
          iyzico_payment_id?: string | null;
          iyzico_payment_transaction_id?: string | null;
          iyzico_raw?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      pharmacies: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          phone: string | null;
          city: string | null;
          district: string | null;
          neighborhood: string | null;
          street: string | null;
          building_no: string | null;
          submerchant_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          phone?: string | null;
          city?: string | null;
          district?: string | null;
          neighborhood?: string | null;
          street?: string | null;
          building_no?: string | null;
          submerchant_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          phone?: string | null;
          city?: string | null;
          district?: string | null;
          neighborhood?: string | null;
          street?: string | null;
          building_no?: string | null;
          submerchant_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
