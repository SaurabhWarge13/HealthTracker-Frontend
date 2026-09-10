import { API_PATHS } from './apiConfig';
import { baseApi } from './baseApi';
import { toProfileBody, type ProfileDto, type ProfilePatch } from './dto';

export const profileApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: builder => ({
    getProfile: builder.query<ProfileDto, void>({
      query: () => ({ url: API_PATHS.PROFILE, method: 'GET' }),
      providesTags: ['Profile'],
    }),
    /**
     * PUT, not PATCH: the server replaces the whole record and writes null
     * over anything omitted. `toProfileBody` takes the complete profile for
     * exactly that reason — a partial update here silently blanks goals.
     */
    updateProfile: builder.mutation<
      ProfileDto,
      ProfilePatch & { baselineWeightKg: number }
    >({
      query: profile => ({
        url: API_PATHS.PROFILE,
        method: 'PUT',
        body: toProfileBody(profile),
      }),
      invalidatesTags: ['Profile'],
    }),
  }),
});

export const {
  useGetProfileQuery,
  useLazyGetProfileQuery,
  useUpdateProfileMutation,
} = profileApi;
