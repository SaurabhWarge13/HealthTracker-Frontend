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
import { awaitSyncIdle } from '@/services/sync';
import { loggedOut } from '@/store/auth/authSlice';
import {
  ACTION_LABEL,
  APP_VERSION,
  CHECKING_LABEL,
  DISCARD_TITLE,
  EMPTY_VALUE,
  FAILED_LABEL,
  FIELD_LABEL,
  GOAL_LABEL,
  HEALTH_CONNECT_LABEL,
  LOGOUT_TITLE,
  NOT_SET,
  PROVIDER_ACTION,
  PROVIDER_ISSUE_COPY,
  REMINDER_TIME_LABEL,
  UNIT,
  discardMessage,
  unsyncedMessage,
} from '@/content';
import {
  disableReminder,
  enableReminder,
} from '@/store/settings/settingsCommands';
import {
  selectReminderActive,
  selectReminderBlocked,
} from '@/store/settings/settingsSelectors';
import {
  selectFailedOps,
  selectUnsyncedCount,
} from '@/store/sync/syncSelectors';
import { opRetryRequested } from '@/store/sync/syncSlice';
import { discardOp } from '@/store/checkins/checkinsCommands';
import { profileSyncRetryRequested } from '@/store/profile/profileSlice';
import { useHealthConnect, useProfileDiscard } from '@/hooks';
import type { PendingOp } from '@/domain/sync';
import {
  selectFieldConnection,
  selectHealthConnect,
  selectHealthConnectProviderIssue,
  selectHealthConnectSupported,
} from '@/store/healthConnect/healthConnectSelectors';
import type { HealthConnectField } from '@/store/healthConnect/healthConnectSlice';
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
} from '@/utils/formatters';
import type {
  EditableProfileField,
  MainTabScreenProps,
} from '@/types/navigation';

const HC_ROW_FIELDS: readonly HealthConnectField[] = [
  'weight',
  'height',
  'steps',
  'sleep',
  'water',
];

export function SettingsScreen({ navigation }: MainTabScreenProps<'Settings'>) {
  const dispatch = useAppDispatch();
  const { colors } = useTheme();
  const profile = useAppSelector(selectProfile);
  const email = useAppSelector(state => state.auth.email);
  const hc = useAppSelector(selectHealthConnect);
  const hcSupported = useAppSelector(selectHealthConnectSupported);
  const hcProviderIssue = useAppSelector(selectHealthConnectProviderIssue);
  const fieldConnection = useAppSelector(selectFieldConnection);
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
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState<PendingOp | null>(null);
  const [confirmProfileDiscard, setConfirmProfileDiscard] = useState(false);
  const discardProfileEdit = useProfileDiscard();

  const failedOps = useAppSelector(selectFailedOps);
  const unsyncedCount = useAppSelector(selectUnsyncedCount);
  const isOnline = useAppSelector(state => state.connectivity.isOnline);

  const edit = useCallback(
    (field: EditableProfileField) =>
      navigation.navigate('EditProfileField', { field }),
    [navigation],
  );

  const signOut = useCallback(async () => {
    setConfirmLogout(false);
    setLoggingOut(true);
    try {
      await awaitSyncIdle();
      try {
        await logout().unwrap();
      } catch {}
      await clearRefreshToken();
      dispatch(baseApi.util.resetApiState());
      dispatch(loggedOut());
    } finally {
      setLoggingOut(false);
    }
  }, [dispatch, logout]);

  const handleLogout = useCallback(() => {
    if (unsyncedCount > 0) {
      setConfirmLogout(true);
      return;
    }
    signOut();
  }, [signOut, unsyncedCount]);

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
                ? EMPTY_VALUE
                : formatWeight(profile.baselineWeightKg)}
            </AppText>
            <AppText variant="bodySmall" color="textMuted">
              {UNIT.kg}
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
          label={FIELD_LABEL.height}
          value={profile.heightCm === null ? NOT_SET : `${profile.heightCm} ${UNIT.cm}`}
          valueMuted={profile.heightCm === null}
          onPress={() => edit('height')}
        />
      </SectionCard>

      <SectionCard icon={Target} tone="user" title="Goals" subtitle="Optional targets">
        <ListRow
          label={GOAL_LABEL.steps}
          value={profile.stepGoal === null ? NOT_SET : formatSteps(profile.stepGoal)}
          valueMuted={profile.stepGoal === null}
          onPress={() => edit('stepGoal')}
        />
        <AppDivider />
        <ListRow
          label={GOAL_LABEL.water}
          value={
            profile.waterGoalMl === null ? NOT_SET : formatWater(profile.waterGoalMl)
          }
          valueMuted={profile.waterGoalMl === null}
          onPress={() => edit('waterGoal')}
        />
        <AppDivider />
        <ListRow
          label={GOAL_LABEL.sleep}
          value={
            profile.sleepGoalMinutes === null
              ? NOT_SET
              : formatDuration(profile.sleepGoalMinutes)
          }
          valueMuted={profile.sleepGoalMinutes === null}
          onPress={() => edit('sleepGoal')}
        />
        <AppDivider />
        <ListRow
          label={GOAL_LABEL.targetWeight}
          value={
            profile.targetWeightKg === null
              ? NOT_SET
              : `${formatWeight(profile.targetWeightKg)} ${UNIT.kg}`
          }
          valueMuted={profile.targetWeightKg === null}
          onPress={() => edit('targetWeight')}
        />
      </SectionCard>

      {hcSupported ? (
        <SectionCard
          icon={Activity}
          tone="device"
          title={HEALTH_CONNECT_LABEL}
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
                  label={ACTION_LABEL.manage}
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
          ) : hc.hasChecked ? (
            <View style={styles.hcRows}>
              {HC_ROW_FIELDS.map(field => (
                <DataTypeStatusRow
                  key={field}
                  label={FIELD_LABEL[field]}
                  status={fieldConnection[field]}
                  muted={fieldConnection[field] === 'notConnected'}
                  chipSize="md"
                />
              ))}
            </View>
          ) : (
            <AppText variant="micro" color="textHint">
              {CHECKING_LABEL}
            </AppText>
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
                label={PROVIDER_ACTION.disabled}
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
                    label={ACTION_LABEL.retry}
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
                    label={ACTION_LABEL.retry}
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
          loading={loggingOut}
          disabled={loggingOut}
          onPress={handleLogout}
        />
      </View>

      <AppDialog
        visible={confirmLogout}
        icon={TriangleAlert}
        title={LOGOUT_TITLE}
        message={unsyncedMessage(unsyncedCount, isOnline)}
        confirm={{
          label: 'Log out',
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
