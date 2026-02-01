import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getGitlabHost, setGitlabHost, clearGitlabHost } from "../lib/commands";

export const useGitlabSettings = () => {
  const queryClient = useQueryClient();

  const {
    data: gitlabHost,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["gitlabHost"],
    queryFn: async () => {
      const response = await getGitlabHost();
      return response.host;
    },
  });

  const setHostMutation = useMutation({
    mutationFn: setGitlabHost,
    onSuccess: (_, variables) => {
      queryClient.setQueryData(["gitlabHost"], variables);
    },
  });

  const clearHostMutation = useMutation({
    mutationFn: clearGitlabHost,
    onSuccess: () => {
      queryClient.setQueryData(["gitlabHost"], null);
    },
  });

  return {
    gitlabHost,
    isLoading,
    error,
    setGitlabHost: setHostMutation.mutate,
    clearGitlabHost: clearHostMutation.mutate,
    isSettingHost: setHostMutation.isPending,
    isClearingHost: clearHostMutation.isPending,
    setHostError: setHostMutation.error,
    clearHostError: clearHostMutation.error,
  };
};
