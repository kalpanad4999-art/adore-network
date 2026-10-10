export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  batch_id: string | null;
  assigned_staff_id: string | null;
  custom_data: Record<string, string> | null;
  photo_path?: string | null;
}

export interface StaffOption { id: string; name: string }

export interface CustomField { id: string; name: string; required: boolean; enabled: boolean; }

export interface Batch {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  fee: number;
  public_token: string;
  required_fields: string[];
  custom_fields: CustomField[];
}


export interface MemberForm { name: string; email: string; phone: string; address: string; notes: string; height: string; weight: string }
export interface MemberPayload { user_id: string; batch_id: string; name: string; email: string | null; phone: string | null; address: string | null; notes: string | null; height_cm: number | null; weight_kg: number | null; custom_data: Record<string, string> }
export interface BatchPayload { user_id: string; name: string; description: string | null; start_date: string | null; fee: number; required_fields: string[]; custom_fields: CustomField[] }
