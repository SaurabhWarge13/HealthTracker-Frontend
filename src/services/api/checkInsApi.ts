import { API_PATHS } from './apiConfig';
import { baseApi } from './baseApi';
import { toCheckInBody, type CheckInDto } from './dto';
import type { CheckIn } from '@/domain/checkins/types';

export const checkInsApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: builder => ({
    listCheckIns: builder.query<CheckInDto[], void>({
      query: () => ({ url: API_PATHS.CHECKINS, method: 'GET' }),
      providesTags: ['CheckIns'],
    }),
    createCheckIn: builder.mutation<CheckInDto, CheckIn>({
      query: checkIn => ({
        url: API_PATHS.CHECKINS,
        method: 'POST',
        body: toCheckInBody(checkIn),
      }),
    }),
    updateCheckIn: builder.mutation<CheckInDto, { serverId: string; checkIn: CheckIn }>({
      query: ({ serverId, checkIn }) => ({
        url: API_PATHS.CHECKIN(serverId),
        method: 'PUT',
        body: toCheckInBody(checkIn),
      }),
    }),
    deleteCheckIn: builder.mutation<void, string>({
      query: serverId => ({ url: API_PATHS.CHECKIN(serverId), method: 'DELETE' }),
    }),
  }),
});

export const { useLazyListCheckInsQuery } = checkInsApi;
