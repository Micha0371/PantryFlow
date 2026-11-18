import { useCallback, useState } from 'react';

interface FormError {
  message: string | null;
  failures: number;
}

// A form's error plus a count of failed submits. Input takes the count as its
// announceKey, so a repeated identical error is announced again (KAN-84).
export function useFormError() {
  const [state, setState] = useState<FormError>({ message: null, failures: 0 });
  const setError = useCallback((message: string | null) => {
    setState(current => ({ message, failures: message ? current.failures + 1 : current.failures }));
  }, []);
  return { error: state.message, failures: state.failures, setError };
}
