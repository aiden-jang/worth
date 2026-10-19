import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { bindPageAccount } from '../api';

/** Draft owners cannot follow a metadata-cache update while account recovery unmounts the page. */
export function useAccountId() {
  const client = useQueryClient();
  const [owner] = useState(() => {
    const id = client.getQueryData<{ user?: { id: string } | null }>(['me'])?.user?.id;
    return id && bindPageAccount(id) ? id : undefined;
  });
  return owner;
}
