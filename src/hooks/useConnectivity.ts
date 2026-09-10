import { useEffect } from 'react';
import { subscribeToConnectivity } from '@/services/network';
import { useAppDispatch } from '@/store/hooks';
import { connectivityChanged } from '@/store/network/connectivitySlice';

export function useConnectivity(): void {
  const dispatch = useAppDispatch();

  useEffect(
    () =>
      subscribeToConnectivity(({ isOnline, isInternetReachable }) => {
        dispatch(
          connectivityChanged({ isOnline, isInternetReachable, at: Date.now() }),
        );
      }),
    [dispatch],
  );
}
