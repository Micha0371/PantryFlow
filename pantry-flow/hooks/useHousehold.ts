import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

// 'err_no_household': the lookup answered without a membership row, or without a household on it.
// 'household_unavailable': the lookup returned an error (timeout, network, server, or PGRST116 for
// more than one row, which UNIQUE(user_id) rules out); each list shows its own load message for it,
// with Try again, instead of telling the user to sign out. maybeSingle() asks for an array, so "no
// row" is an empty answer, never the single-object 406 that PGRST116 shares with "more than one".
export type HouseholdError = 'err_no_household' | 'household_unavailable';

// Used once by HouseholdProvider; providers and screens consume useHouseholdScope.
export function useHousehold() {
  const { user } = useAuth();
  const userId = user?.id;
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HouseholdError | null>(null);
  const generation = useRef(0);

  const refreshHousehold = useCallback(async () => {
    const request = ++generation.current;
    setHouseholdId(null);
    setError(null);
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error: err } = await supabase.from('pantry_household_members')
        .select('household_id').eq('user_id', userId).maybeSingle();
      const found = data?.household_id;
      if (request === generation.current) {
        if (err) setError('household_unavailable');
        else if (found) setHouseholdId(found);
        else setError('err_no_household');
      }
    } catch {
      if (request === generation.current) setError('household_unavailable');
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refreshHousehold();
    return () => { generation.current++; };
  }, [refreshHousehold]);

  return { householdId, loading, error, refreshHousehold };
}
