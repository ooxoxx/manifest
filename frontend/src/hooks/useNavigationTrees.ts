import { useQuery } from "@tanstack/react-query"

import { SamplesService, TagsService } from "@/client"

export function useStorageTree() {
  return useQuery({
    queryKey: ["storage-tree"],
    queryFn: () => SamplesService.getStorageTree(),
    staleTime: 30000,
  })
}

export function useBusinessTagsTree() {
  return useQuery({
    queryKey: ["business-tags-tree-with-counts"],
    queryFn: () => TagsService.getBusinessTagTreeWithCounts(),
    staleTime: 30000,
  })
}
