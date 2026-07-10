export interface Member {
  id: number;
  store_id: number;
  name: string;
  phone: string;
  total_points: number;
  lifetime_points: number;
  orders_count?: number;
  created_at: string;
  updated_at: string;
}

export interface MemberRFM extends Member {
  frequency: number;
  monetary: number;
  last_order_at: string | null;
  recency_days: number | null;
}

export interface PointTransaction {
  id: number;
  member_id: number;
  order_id: number | null;
  points: number;
  type: 'earn' | 'redeem';
  description: string | null;
  created_at: string;
}

export interface PointReward {
  id: number;
  store_id: number;
  name: string;
  description: string | null;
  points_required: number;
  menu_item_id: number | null;
  is_active: boolean;
  menu_item?: {
    id: number;
    name: string;
    price: number;
  };
  created_at: string;
}
