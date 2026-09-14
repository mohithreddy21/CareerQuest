import { queryOptions } from '@tanstack/react-query';
import { getPreparationMaterials } from './service';

export const preparationKeys = {
  all: ['preparation'] as const,
  materials: (applicationId: string) =>
    [...preparationKeys.all, 'materials', applicationId] as const
};

export const preparationMaterialsQueryOptions = (applicationId: string) =>
  queryOptions({
    queryKey: preparationKeys.materials(applicationId),
    queryFn: () => getPreparationMaterials(applicationId)
  });
