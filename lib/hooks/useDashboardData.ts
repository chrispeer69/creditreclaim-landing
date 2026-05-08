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

export type LetterSuggestion = {
  id: string;
  number: number;
  stage: string;
  category: string;
  title: string;
  when_to_use: string;
};

export type DashboardData = {
  user: User | null;
  credits: UserCredits | null;
  disputes: Dispute[];
  responses: DisputeResponse[];
  recommendations: Recommendation[];
  suggestedLetters: LetterSuggestion[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

// Pick the dispute stage we surface in "Send today" based on what the
// user has been through. Crude on purpose — refine when there's real
// stage tracking in user_credits.
function pickStage(disputes: Dispute[]): string {
  const hasRejection = disputes.some(d => d.status === 'rejected');
  const repeatedRejections =
    disputes.filter(d => d.status === 'rejected').length >= 2;
  if (repeatedRejections) {
    return 'Stage 3: Legal — Attorney-Level Demands';
  }
  if (hasRejection) {
    return 'Stage 2: Escalation & Collector Disputes';
  }
  return 'Stage 1: Initial Disputes - Direct to Bureaus';
}

export function useDashboardData(): DashboardData {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [responses, setResponses] = useState<DisputeResponse[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [suggestedLetters, setSuggestedLetters] = useState<LetterSuggestion[]>(
    [],
  );
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
        setSuggestedLetters([]);
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

      const stage = pickStage(disputeRows);
      const lettersPromise = supabase
        .from('letters')
        .select('id, number, stage, category, title, when_to_use')
        .eq('stage', stage)
        .order('number', { ascending: true })
        .limit(3);

      const disputeIds = disputeRows.map(d => d.id);
      const responsesPromise =
        disputeIds.length > 0
          ? supabase
              .from('responses')
              .select('*')
              .in('dispute_id', disputeIds)
              .order('received_date', { ascending: false })
          : Promise.resolve({ data: [], error: null } as const);

      const [lettersRes, respRes] = await Promise.all([
        lettersPromise,
        responsesPromise,
      ]);

      // Letters are nice-to-have — never break the dashboard if the table
      // hasn't been seeded yet.
      if (!lettersRes.error) {
        setSuggestedLetters(
          (lettersRes.data as LetterSuggestion[] | null) ?? [],
        );
      } else {
        setSuggestedLetters([]);
      }

      if (respRes.error) throw respRes.error;
      setResponses((respRes.data as DisputeResponse[]) ?? []);
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
    suggestedLetters,
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
