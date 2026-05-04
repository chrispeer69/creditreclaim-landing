'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type Tier = 'diy' | 'managed' | string;

export type UserCredits = {
  id: string;
  current_score: number | null;
  initial_score: number | null;
  removed_count: number | null;
  tier: Tier | null;
  updated_at: string | null;
};

export type DisputeStatus =
  | 'draft'
  | 'sent'
  | 'in_review'
  | 'responded'
  | 'removed'
  | 'rejected'
  | string;

export type Dispute = {
  id: string;
  user_id: string;
  creditor_name: string | null;
  account_number: string | null;
  dispute_type: string | null;
  letter_sent_date: string | null;
  status: DisputeStatus;
  response_received_date: string | null;
  removed_date: string | null;
  notes: string | null;
  created_at: string | null;
};

export type DisputeResponse = {
  id: string;
  dispute_id: string;
  received_date: string | null;
  content: string | null;
  bureau_name: string | null;
  created_at: string | null;
};

export type Recommendation = {
  id: string;
  user_id: string;
  type: string | null;
  title: string | null;
  description: string | null;
  priority: number | null;
  dismissed: boolean | null;
  created_at: string | null;
};

export type DashboardData = {
  user: User | null;
  credits: UserCredits | null;
  disputes: Dispute[];
  responses: DisputeResponse[];
  recommendations: Recommendation[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useDashboardData(): DashboardData {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [responses, setResponses] = useState<DisputeResponse[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData.session?.user ?? null;
      setUser(currentUser);

      if (!currentUser) {
        setCredits(null);
        setDisputes([]);
        setResponses([]);
        setRecommendations([]);
        return;
      }

      const [creditsRes, disputesRes, recommendationsRes] = await Promise.all([
        supabase
          .from('user_credits')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle(),
        supabase
          .from('disputes')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('recommendations')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('dismissed', false)
          .order('priority', { ascending: true })
          .order('created_at', { ascending: false }),
      ]);

      if (creditsRes.error) throw creditsRes.error;
      if (disputesRes.error) throw disputesRes.error;
      if (recommendationsRes.error) throw recommendationsRes.error;

      setCredits((creditsRes.data as UserCredits | null) ?? null);
      const disputeRows = (disputesRes.data as Dispute[]) ?? [];
      setDisputes(disputeRows);
      setRecommendations((recommendationsRes.data as Recommendation[]) ?? []);

      const disputeIds = disputeRows.map(d => d.id);
      if (disputeIds.length > 0) {
        const { data: respData, error: respErr } = await supabase
          .from('responses')
          .select('*')
          .in('dispute_id', disputeIds)
          .order('received_date', { ascending: false });
        if (respErr) throw respErr;
        setResponses((respData as DisputeResponse[]) ?? []);
      } else {
        setResponses([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [load]);

  return {
    user,
    credits,
    disputes,
    responses,
    recommendations,
    loading,
    error,
    refetch: load,
  };
}

// Single-dispute fetcher used by the detail page; co-located so the
// type contract stays in one place.
export type DisputeWithResponses = {
  dispute: Dispute | null;
  responses: DisputeResponse[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useDisputeDetail(disputeId: string | undefined): DisputeWithResponses {
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [responses, setResponses] = useState<DisputeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!disputeId) {
      setDispute(null);
      setResponses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData.session?.user ?? null;
      if (!currentUser) {
        setDispute(null);
        setResponses([]);
        return;
      }
      const [disputeRes, responsesRes] = await Promise.all([
        supabase
          .from('disputes')
          .select('*')
          .eq('id', disputeId)
          .eq('user_id', currentUser.id)
          .maybeSingle(),
        supabase
          .from('responses')
          .select('*')
          .eq('dispute_id', disputeId)
          .order('received_date', { ascending: false }),
      ]);
      if (disputeRes.error) throw disputeRes.error;
      if (responsesRes.error) throw responsesRes.error;
      setDispute((disputeRes.data as Dispute | null) ?? null);
      setResponses((responsesRes.data as DisputeResponse[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dispute');
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    load();
  }, [load]);

  return { dispute, responses, loading, error, refetch: load };
}
