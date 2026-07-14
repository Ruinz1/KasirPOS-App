import api from './api';
import type { Member, MemberRFM, PointReward, PointTransaction } from '@/types/member';

export const memberApi = {
  list: (search?: string) =>
    api.get<Member[]>('/members', { params: search ? { search } : {} }),

  rfm: (params: { type: 'spender' | 'frequency' | 'inactive'; inactive_days?: number; search?: string }) =>
    api.get<MemberRFM[]>('/members/rfm', { params }),

  findByPhone: (phone: string) =>
    api.post<Member>('/members/find-by-phone', { phone }),

  create: (data: { name: string; phone: string }) =>
    api.post<Member>('/members', data),

  update: (id: number, data: Partial<{ name: string; phone: string }>) =>
    api.put<Member>(`/members/${id}`, data),

  show: (id: number) =>
    api.get<Member & { point_transactions: PointTransaction[] }>(`/members/${id}`),

  destroy: (id: number) =>
    api.delete(`/members/${id}`),

  transactions: (id: number, page = 1) =>
    api.get<{ data: PointTransaction[] }>(`/members/${id}/transactions`, { params: { page } }),

  sendPointsInfo: (id: number) =>
    api.post<{ message: string; method?: 'template' | 'text' }>(`/members/${id}/send-points-info`),
};

export const rewardApi = {
  list: () =>
    api.get<PointReward[]>('/point-rewards'),

  create: (data: { name: string; description?: string; points_required: number; menu_item_id?: number | null; is_active?: boolean }) =>
    api.post<PointReward>('/point-rewards', data),

  update: (id: number, data: Partial<{ name: string; description: string; points_required: number; menu_item_id: number | null; is_active: boolean }>) =>
    api.put<PointReward>(`/point-rewards/${id}`, data),

  destroy: (id: number) =>
    api.delete(`/point-rewards/${id}`),
};
