import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAccountId } from './useAccountId';
import { sharedCapture, type IncomingCapture } from '../shared/web-capture';
import { clearIncomingCapture, readIncomingCapture, stageIncomingCapture } from '../shared/incoming-capture';

export function useIncomingCapture() {
  const owner = useAccountId();
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
        setStorageFailed(!stageIncomingCapture(fromUrl, owner));
        // Sign-in links return to the clean capture route; incoming content is never sent to Accounts.
        navigate('/capture', { replace: true });
      } else {
        const stored = readIncomingCapture(owner);
        setIncoming(stored.incoming);
        setStorageFailed(stored.storageFailed);
      }
    } catch {
      setError('Couldn’t read this shared content. Paste a name or link below instead.');
    }
  }, [location.hash, location.search, navigate, owner]);
  function dismiss() {
    clearIncomingCapture();
    setIncoming(null);
  }
  return { incoming, dismiss, storageFailed, error };
}
