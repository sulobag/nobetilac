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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          vehicle_type: "motorcycle" | "car" | "bicycle" | "scooter";
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          vehicle_type?: "motorcycle" | "car" | "bicycle" | "scooter";
          is_available?: boolean;
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
