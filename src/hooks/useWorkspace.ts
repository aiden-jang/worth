import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { CollectionWorkspace } from '../shared/workspace';

export function useWorkspace(listId: string) {
  const client = useQueryClient();
  const key = ['workspace', listId];
  const query = useQuery({ queryKey: key, queryFn: () => api.workspace(listId) });
  const mutation = useMutation({
    mutationFn: async (workspace: CollectionWorkspace) => {
      if (!query.data || query.isFetching) throw new Error('Wait for the saved tools to load.');
      return api.updateWorkspace(listId, workspace, query.data.revision);
    },
    onSuccess: (data) => client.setQueryData(key, data),
  });
  return { query, mutation };
}
