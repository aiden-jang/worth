import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { incomingCapture, sharedCapture, type IncomingCapture } from '../shared/web-capture';

const key = 'worth:incoming-web-share';
const lifetime = 15 * 60 * 1000;

export function useIncomingCapture() {
  const location = useLocation(),
    navigate = useNavigate();
  const [storageFailed, setStorageFailed] = useState(false);
  const [error, setError] = useState('');
  const [incoming, setIncoming] = useState<IncomingCapture | null>(null);
  useEffect(() => {
    try {
      const fromUrl =
        sharedCapture(new URLSearchParams(location.hash.slice(1))) ??
        sharedCapture(new URLSearchParams(location.search));
      if (fromUrl) {
        setIncoming(fromUrl);
        try {
          sessionStorage.setItem(key, JSON.stringify({ value: fromUrl, expires: Date.now() + lifetime }));
        } catch {
          setStorageFailed(true);
        }
        // Sign-in links return to the clean capture route; incoming content is never sent to Accounts.
        navigate('/capture', { replace: true });
      } else {
        const stored = JSON.parse(sessionStorage.getItem(key) ?? 'null');
        const parsed = incomingCapture.safeParse(stored?.value);
        if (stored?.expires > Date.now() && parsed.success) setIncoming(parsed.data);
        else sessionStorage.removeItem(key);
      }
    } catch {
      setError('Couldn’t read this shared content. Paste a name or link below instead.');
    }
  }, [location.hash, location.search, navigate]);
  function dismiss() {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* The in-memory incoming share can still be dismissed. */
    }
    setIncoming(null);
  }
  return { incoming, dismiss, storageFailed, error };
}
