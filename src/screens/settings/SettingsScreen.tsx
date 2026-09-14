import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Activity,
  Bell,
  ChartNoAxesColumn,
  ChevronRight,
  Clock,
  ExternalLink,
  Info,
  LogOut,
  Target,
  TriangleAlert,
} from 'lucide-react-native';
import {
  AppButton,
  AppDivider,
  AppIcon,
  AppScreen,
  AppSwitch,
  AppText,
  Avatar,
  InlineNote,
} from '@/components/common';
import { DataTypeStatusRow } from '@/components/data';
import { ListRow, SectionCard } from '@/components/layout';
import { AppDialog } from '@/components/overlays';
import { clearRefreshToken } from '@/security/tokenStore';
import { baseApi } from '@/services/api/baseApi';
import { useLogoutMutation } from '@/services/api';
import { openNotificationSettings } from '@/services/notifications';
import { awaitSyncIdle, runSync } from '@/services/sync';
import { loggedOut } from '@/store/auth/authSlice';
import { REMINDER_HOUR } from '@/domain/notifications/schedule';
import {
  disableReminder,
  enableReminder,
} from '@/store/settings/settingsCommands';
import {
  selectReminderActive,
  selectReminderBlocked,
} from '@/store/settings/settingsSelectors';
import { store } from '@/store/store';
import {
  selectFailedOps,
  selectPendingCount,
} from '@/store/sync/syncSelectors';
import { opRetryRequested } from '@/store/sync/syncSlice';
import { discardOp } from '@/store/checkins/checkinsCommands';
import { profileSyncRetryRequested } from '@/store/profile/profileSlice';
import { useHealthConnect, useProfileDiscard } from '@/hooks';
import type { ProviderIssue } from '@/domain/healthConnect/provider';
import type { PendingOp, SyncOpKind } from '@/domain/sync';
import {
  selectHealthConnect,
  selectHealthConnectProviderIssue,
  selectHealthConnectSupported,
} from '@/store/healthConnect/healthConnectSelectors';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectProfile } from '@/store/profile/profileSelectors';
import { useTheme } from '@/hooks/useTheme';
import { layout, radius, spacing } from '@/theme';
import {
  formatDuration,
  formatShortDate,
  formatSteps,
  formatTime,
  formatWater,
  formatWeight,
  formatWeightWithUnit,
} from '@/utils/formatters';
import type {
  EditableProfileField,
  MainTabScreenProps,
} from '@/types/navigation';

const APP_VERSION = '1.0.0 (1)';

const PROVIDER_ISSUE_COPY: Record<ProviderIssue, { note: string; action: string }> = {
  missing: {
    note: "Health Connect isn't installed on this phone, so there is nothing to read from yet.",
    action: 'Get Health Connect',
  },
  disabled: {
    note: 'Health Connect is turned off on this phone, so this app cannot read from it.',
    action: 'Open settings',
  },
  updateRequired: {
    note: 'Health Connect needs an update before this app can read from it.',
    action: 'Update Health Connect',
  },
};

const REMINDER_TIME_LABEL = `${REMINDER_HOUR % 12 || 12}:00 ${
  REMINDER_HOUR < 12 ? 'AM' : 'PM'
}`;

const FAILED_LABEL: Record<SyncOpKind, string> = {
  create: 'A new check-in',
  update: 'An edited check-in',
  delete: 'A deleted check-in',
};

export function SettingsScreen({ navigation }: MainTabScreenProps<'Settings'>) {
  const dispatch = useAppDispatch();
  const { colors } = useTheme();
  const profile = useAppSelector(selectProfile);
  const email = useAppSelector(state => state.auth.email);
  const hc = useAppSelector(selectHealthConnect);
  const hcSupported = useAppSelector(selectHealthConnectSupported);
  const hcProviderIssue = useAppSelector(selectHealthConnectProviderIssue);
  const { openSettings: openHealthConnectSettings, openProviderInstall } =
    useHealthConnect();
  const [logout] = useLogoutMutation();

  const reminderActive = useAppSelector(selectReminderActive);
  const reminderBlocked = useAppSelector(selectReminderBlocked);

  const toggleReminder = useCallback(
    (next: boolean) => {
      dispatch(next ? enableReminder() : disableReminder());
    },
    [dispatch],
  );

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState<PendingOp | null>(null);
  const [confirmProfileDiscard, setConfirmProfileDiscard] = useState(false);
  const discardProfileEdit = useProfileDiscard();

  const pendingCount = useAppSelector(selectPendingCount);
  const failedOps = useAppSelector(selectFailedOps);
  const profileUnsynced = profile.pendingSync || profile.syncFailed;
  const unsyncedCount =
    pendingCount + failedOps.length + (profileUnsynced ? 1 : 0);

  const edit = useCallback(
    (field: EditableProfileField) =>
      navigation.navigate('EditProfileField', { field }),
    [navigation],
  );

  const signOut = useCallback(async () => {
    setConfirmLogout(false);
    await awaitSyncIdle();
    try {
      await logout().unwrap();
    } catch {}
    await clearRefreshToken();
    dispatch(baseApi.util.resetApiState());
    dispatch(loggedOut());
  }, [dispatch, logout]);

  const handleLogout = useCallback(() => {
    if (unsyncedCount > 0) {
      setConfirmLogout(true);
      return;
    }
    signOut();
  }, [signOut, unsyncedCount]);

  const syncThenLogout = useCallback(async () => {
    await runSync(store);
    const state = store.getState();
    const stillUnsynced =
      state.sync.ops.length > 0 ||
      state.profile.pendingSync ||
      state.profile.syncFailed;
    if (!stillUnsynced) {
      signOut();
      return;
    }
  }, [signOut]);

  const status = (field: 'weight' | 'height' | 'steps' | 'sleep' | 'water') =>
    hc.availability[field] === 'PERMISSION_DENIED' ? 'notConnected' : 'connected';

  return (
    <AppScreen
      scroll
      padded="horizontal"
      contentStyle={styles.content}
    >
      <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
        <Avatar name={profile.name || email || 'H'} size={64} />
        <View style={styles.profileText}>
          <AppText variant="cardTitle" numberOfLines={1}>
            {profile.name.trim() === '' ? 'Your profile' : profile.name}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {email ?? 'Not signed in'}
          </AppText>
        </View>
      </View>

      <SectionCard
        icon={ChartNoAxesColumn}
        tone="user"
        title="Your baseline"
        subtitle="Used to measure progress"
      >
        <Pressable
          onPress={() => edit('baselineWeight')}
          accessibilityRole="button"
          accessibilityLabel="Edit baseline weight"
          style={({ pressed }) => [
            styles.baseline,
            pressed && { backgroundColor: colors.surfaceNeutral },
          ]}
        >
          <AppText variant="label" color="textMuted">
            Baseline weight
          </AppText>
          <View style={styles.baselineValue}>
            <AppText variant="title" numeric>
              {profile.baselineWeightKg === null
                ? '—'
                : formatWeight(profile.baselineWeightKg)}
            </AppText>
            <AppText variant="bodySmall" color="textMuted">
              kg
            </AppText>
            <View style={styles.spacer} />
            <AppIcon icon={ChevronRight} size="base" color="textHint" />
          </View>
          <AppText variant="micro" color="textHint">
            {profile.baselineSetAt === null
              ? 'Every change is measured from here'
              : `Set ${formatShortDate(
                profile.baselineSetAt,
              )} · every change is measured from here`}
          </AppText>
        </Pressable>

        <AppDivider style={styles.baselineDivider} />

        <ListRow
          label="Height"
          value={profile.heightCm === null ? 'Not set' : `${profile.heightCm} cm`}
          valueMuted={profile.heightCm === null}
          onPress={() => edit('height')}
        />
      </SectionCard>

      <SectionCard icon={Target} tone="user" title="Goals" subtitle="Optional targets">
        <ListRow
          label="Daily steps"
          value={profile.stepGoal === null ? 'Not set' : formatSteps(profile.stepGoal)}
          valueMuted={profile.stepGoal === null}
          onPress={() => edit('stepGoal')}
        />
        <AppDivider />
        <ListRow
          label="Daily water"
          value={
            profile.waterGoalMl === null ? 'Not set' : formatWater(profile.waterGoalMl)
          }
          valueMuted={profile.waterGoalMl === null}
          onPress={() => edit('waterGoal')}
        />
        <AppDivider />
        <ListRow
          label="Nightly sleep"
          value={
            profile.sleepGoalMinutes === null
              ? 'Not set'
              : formatDuration(profile.sleepGoalMinutes)
          }
          valueMuted={profile.sleepGoalMinutes === null}
          onPress={() => edit('sleepGoal')}
        />
        <AppDivider />
        <ListRow
          label="Target weight"
          value={
            profile.targetWeightKg === null
              ? 'Not set'
              : `${formatWeight(profile.targetWeightKg)} kg`
          }
          valueMuted={profile.targetWeightKg === null}
          onPress={() => edit('targetWeight')}
        />
      </SectionCard>

      {hcSupported ? (
        <SectionCard
          icon={Activity}
          tone="device"
          title="Health Connect"
          subtitle={
            hcProviderIssue === null ? 'Connected data types' : 'Not set up yet'
          }
          footer={
            hcProviderIssue === null ? (
              <View style={styles.hcFooter}>
                <AppText variant="micro" color="textHint">
                  Read-only
                  {hc.today.syncedAt !== null
                    ? ` · ${formatTime(hc.today.syncedAt)}`
                    : ''}
                </AppText>
                <AppButton
                  label="Manage"
                  variant="text"
                  tone="device"
                  size={48}
                  onPress={openHealthConnectSettings}
                  icon={ExternalLink}
                />
              </View>
            ) : undefined
          }
        >
          {hcProviderIssue !== null ? (
            <View style={styles.hcSetup}>
              <InlineNote icon={Info}>
                {PROVIDER_ISSUE_COPY[hcProviderIssue].note}
              </InlineNote>
              <AppButton
                label={PROVIDER_ISSUE_COPY[hcProviderIssue].action}
                variant="text"
                tone="device"
                size={48}
                onPress={
                  hcProviderIssue === 'disabled'
                    ? openHealthConnectSettings
                    : openProviderInstall
                }
                icon={ExternalLink}
              />
            </View>
          ) : (
            <View style={styles.hcRows}>
              <DataTypeStatusRow
                label="Weight"
                status={status('weight')}
                muted={status('weight') === 'notConnected'}
                chipSize="md"
              />
              <DataTypeStatusRow
                label="Height"
                status={status('height')}
                muted={status('height') === 'notConnected'}
                chipSize="md"
              />
              <DataTypeStatusRow
                label="Steps"
                status={status('steps')}
                muted={status('steps') === 'notConnected'}
                chipSize="md"
              />
              <DataTypeStatusRow
                label="Sleep"
                status={status('sleep')}
                muted={status('sleep') === 'notConnected'}
                chipSize="md"
              />
              <DataTypeStatusRow
                label="Water"
                status={status('water')}
                muted={status('water') === 'notConnected'}
                chipSize="md"
              />
            </View>
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        icon={Bell}
        tone="user"
        title="Reminders"
        subtitle="Local to this device"
        footer={
          reminderBlocked ? (
            <View style={styles.reminderFooter}>
              <InlineNote icon={Info}>
                Notifications are turned off for HealthTracker, so this reminder
                cannot be delivered.
              </InlineNote>
              <AppButton
                label="Open settings"
                variant="text"
                size={48}
                onPress={openNotificationSettings}
                icon={ExternalLink}
              />
            </View>
          ) : undefined
        }
      >
        <ListRow
          leadingIcon={Clock}
          label="Daily check-in"
          value={REMINDER_TIME_LABEL}
          trailing={
            <AppSwitch
              value={reminderActive}
              onValueChange={toggleReminder}
              accessibilityLabel={`Daily check-in reminder at ${REMINDER_TIME_LABEL}`}
            />
          }
        />
      </SectionCard>

      {failedOps.length > 0 || profile.syncFailed ? (
        <SectionCard
          icon={TriangleAlert}
          tone="device"
          title="Changes that couldn't sync"
          subtitle="Still safe on this device"
        >
          <View style={styles.failedRows}>
            {failedOps.map((op, index) => (
              <View key={op.opId}>
                {index > 0 ? <AppDivider style={styles.failedDivider} /> : null}
                <View style={styles.failedRow}>
                  <View style={styles.failedText}>
                    <AppText variant="rowTitle">{FAILED_LABEL[op.kind]}</AppText>
                    <AppText variant="micro" color="textHint" numberOfLines={2}>
                      {op.lastError ?? 'Could not be sent.'}
                    </AppText>
                  </View>
                  <AppButton
                    label="Retry"
                    variant="text"
                    tone="device"
                    size={32}
                    onPress={() =>
                      dispatch(opRetryRequested({ opId: op.opId, at: Date.now() }))
                    }
                  />
                  <AppButton
                    label="Discard"
                    variant="text"
                    tone="danger"
                    size={32}
                    onPress={() => setConfirmDiscard(op)}
                  />
                </View>
              </View>
            ))}

            {profile.syncFailed ? (
              <View>
                {failedOps.length > 0 ? (
                  <AppDivider style={styles.failedDivider} />
                ) : null}
                <View style={styles.failedRow}>
                  <View style={styles.failedText}>
                    <AppText variant="rowTitle">Your profile</AppText>
                    <AppText variant="micro" color="textHint" numberOfLines={2}>
                      {profile.lastError ?? 'Could not be sent.'}
                    </AppText>
                  </View>
                  <AppButton
                    label="Retry"
                    variant="text"
                    tone="device"
                    size={32}
                    onPress={() => dispatch(profileSyncRetryRequested())}
                  />
                  <AppButton
                    label="Discard"
                    variant="text"
                    tone="danger"
                    size={32}
                    onPress={() => setConfirmProfileDiscard(true)}
                  />
                </View>
              </View>
            ) : null}
          </View>
        </SectionCard>
      ) : null}

      <SectionCard icon={Info} tone="neutral" title="About" subtitle="App and legal">
        <ListRow label="App version" value={APP_VERSION} valueMuted />
        <AppDivider />
        <ListRow label="Privacy policy" onPress={() => { }} />
        <AppDivider />
        <ListRow label="Terms of use" onPress={() => { }} />
      </SectionCard>

      <View style={[styles.logoutCard, { backgroundColor: colors.surface }]}>
        <AppButton
          label="Log out"
          variant="text"
          tone="danger"
          size={52}
          fullWidth
          icon={LogOut}
          onPress={handleLogout}
        />
      </View>

      <AppDialog
        visible={confirmLogout}
        icon={Clock}
        title="Sync before you log out"
        message={`${unsyncedCount} ${unsyncedCount === 1 ? 'change is' : 'changes are'
          } still saved only on this device. Logging out erases what is on this device, so ${unsyncedCount === 1 ? 'it' : 'they'
          } would be lost for good.`}
        layout="stacked"
        confirm={{ label: 'Try sync again', onPress: () => { syncThenLogout(); } }}
        secondary={{
          label: 'Log out & discard',
          destructive: true,
          onPress: () => { signOut(); },
        }}
        onCancel={() => setConfirmLogout(false)}
      />

      <AppDialog
        visible={confirmDiscard !== null}
        icon={TriangleAlert}
        title={confirmDiscard === null ? '' : DISCARD_TITLE[confirmDiscard.kind]}
        message={confirmDiscard === null ? '' : discardMessage(confirmDiscard)}
        confirm={{
          label: 'Discard',
          destructive: true,
          onPress: () => {
            if (confirmDiscard !== null) {
              dispatch(discardOp(confirmDiscard.opId));
            }
            setConfirmDiscard(null);
          },
        }}
        cancelLabel="Keep it"
        onCancel={() => setConfirmDiscard(null)}
      />

      <AppDialog
        visible={confirmProfileDiscard}
        icon={TriangleAlert}
        title="Discard your profile changes?"
        message="Your profile will go back to the version saved on the server. This needs a connection, and it can't be undone."
        confirm={{
          label: 'Discard',
          destructive: true,
          onPress: () => {
            discardProfileEdit();
            setConfirmProfileDiscard(false);
          },
        }}
        cancelLabel="Keep them"
        onCancel={() => setConfirmProfileDiscard(false)}
      />
    </AppScreen>
  );
}

const DISCARD_TITLE: Record<SyncOpKind, string> = {
  create: 'Discard this check-in?',
  update: 'Discard this edit?',
  delete: 'Keep this check-in after all?',
};

function discardMessage(op: PendingOp): string {
  const before = op.before ?? null;

  if (op.kind === 'create' || before === null) {
    return "This check-in was never sent, so it will be removed from this device. This can't be undone.";
  }
  if (op.kind === 'update') {
    return `Your changes will be undone and the check-in will go back to ${formatWeightWithUnit(
      before.weightKg,
    )}, the version on the server.`;
  }
  return 'The check-in was never removed from the server, so it will reappear in your history.';
}

const styles = StyleSheet.create({
  content: { paddingVertical: layout.screenPadding, gap: layout.screenPadding },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radius.card,
    paddingVertical: spacing.lg + spacing.xs,
    paddingHorizontal: layout.cardPadding,
    marginTop: 20
  },
  profileText: { flex: 1, gap: spacing.xs },
  baseline: { gap: spacing.xs },
  spacer: { flex: 1 },
  baselineValue: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  baselineDivider: { marginVertical: layout.cardPadding },
  hcRows: { gap: 14 },
  hcSetup: { gap: spacing.xs, alignItems: 'flex-start' },
  failedRows: { gap: spacing.sm },
  failedDivider: { marginBottom: spacing.sm },
  failedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  failedText: { flex: 1, gap: 2 },
  hcFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderFooter: { gap: spacing.xs, alignItems: 'flex-start' },
  logoutCard: { borderRadius: radius.card, padding: spacing.sm },
});
