import {
  createSearchParamsCache,
  createSerializer,
  parseAsInteger,
  parseAsString
} from 'nuqs/server';

export const searchParams = {
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(10),
  search: parseAsString,
  source: parseAsString,
  status: parseAsString,
  workArrangement: parseAsString,
  sort: parseAsString,
  minMatch: parseAsInteger
};

export const searchParamsCache = createSearchParamsCache(searchParams);
export const serialize = createSerializer(searchParams);
