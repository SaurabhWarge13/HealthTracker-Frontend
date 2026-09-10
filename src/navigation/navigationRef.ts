import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootParamList } from '@/types/navigation';

/**
 * Lets non-component code (deep-link replay, later the sync manager)
 * navigate without prop drilling. Always check `isReady()` first.
 */
export const navigationRef = createNavigationContainerRef<RootParamList>();
