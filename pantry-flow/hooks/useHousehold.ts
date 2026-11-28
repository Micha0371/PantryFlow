import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

// 'err_no_household': the lookup found no membership row (PGRST116) or no household on it.
// 'household_unavailable': the lookup itself failed (timeout, network, server); each list shows its
// own load message for it, with Try again, instead of telling the user to sign out.
export type HouseholdError = 'err_no_household' | 'household_unavailable';
const NO_HOUSEHOLD = 'PGRST116';

// No error means the lookup answered, but without a household on the row.
function lookupError(err: { code?: string } | null): HouseholdError {
  if (!err || err.code === NO_HOUSEHOLD) return 'err_no_household';
  return 'household_unavailable';
}

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
        .select('household_id').eq('user_id', userId).single();
      const found = data?.household_id;
      if (request === generation.current) {
        if (err || !found) setError(lookupError(err));
        else setHouseholdId(found);
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
