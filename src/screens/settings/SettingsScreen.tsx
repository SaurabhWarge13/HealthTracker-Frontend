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

/**
 * Health Connect is unusable but fixable. Says what is wrong and names the one
 * action that fixes it, the same shape as the blocked-reminder note below.
 */
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

/** Derived from the domain constant so the row cannot drift from the trigger. */
const REMINDER_TIME_LABEL = `${REMINDER_HOUR % 12 || 12}:00 ${
  REMINDER_HOUR < 12 ? 'AM' : 'PM'
}`;

/** Says what the user did, not what the request was. */
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
      // Turning it on is the only moment the app asks for permission.
      dispatch(next ? enableReminder() : disableReminder());
    },
    [dispatch],
  );

  const [confirmLogout, setConfirmLogout] = useState(false);
  /** The op the user is about to abandon, held so the dialog can name it. */
  const [confirmDiscard, setConfirmDiscard] = useState<PendingOp | null>(null);
  const [confirmProfileDiscard, setConfirmProfileDiscard] = useState(false);
  const discardProfileEdit = useProfileDiscard();

  const pendingCount = useAppSelector(selectPendingCount);
  const failedOps = useAppSelector(selectFailedOps);
  /**
   * A profile edit is unsynced work too, and logging out would discard it.
   *
   * `syncFailed` has to count as well as `pendingSync`. A permanently
   * rejected push keeps both set, but reading only one of them would be a
   * trap the moment that stops being true: an edit the server refused is
   * exactly the kind that is easiest to lose and hardest to notice.
   */
  const profileUnsynced = profile.pendingSync || profile.syncFailed;
  const unsyncedCount =
    pendingCount + failedOps.length + (profileUnsynced ? 1 : 0);

  const edit = useCallback(
    (field: EditableProfileField) =>
      navigation.navigate('EditProfileField', { field }),
    [navigation],
  );

  /**
   * The server call is best-effort: it clears the stored refresh hash, but a
   * network failure must never trap someone inside the app. The Keychain is
   * cleared regardless, and `loggedOut()` — a deliberate act, unlike an
   * expired session — wipes what is on the device.
   */
  const signOut = useCallback(async () => {
    setConfirmLogout(false);
    /**
     * Let whatever is already on the wire settle first.
     *
     * Tearing the account down underneath a request that is about to return
     * is how a cleared queue comes back. Bounded by the transport's own
     * timeout, so an unreachable server cannot hold logout hostage — and
     * `sessionEpoch` still rejects anything that lands after this point.
     */
    await awaitSyncIdle();
    try {
      await logout().unwrap();
    } catch {
      // Best-effort: it clears the stored refresh hash, but a network failure
      // must never trap someone inside the app.
    }
    await clearRefreshToken();
    /**
     * One action, and every account-scoped slice resets itself on it — see
     * the `extraReducers` in checkins, profile, onboarding, sync, settings
     * and healthConnect. The RTK Query cache is the one thing that cannot
     * self-reset, so it is cleared explicitly; leaving it would hand the next
     * account this one's cached responses.
     */
    dispatch(baseApi.util.resetApiState());
    dispatch(loggedOut());
  }, [dispatch, logout]);

  /**
   * Blocked while anything is still only on this device (6c). Logging out
   * wipes local data, so doing it with work queued would silently discard
   * something the user wrote — the worst outcome in the app.
   */
  const handleLogout = useCallback(() => {
    if (unsyncedCount > 0) {
      setConfirmLogout(true);
      return;
    }
    // Nothing to lose, so nothing to ask and no network needed.
    signOut();
  }, [signOut, unsyncedCount]);

  /**
   * Push everything that is queued, then log out only if it all made it.
   *
   * `runSync`, not `drainSyncQueue`: a dirty profile counts toward
   * `unsyncedCount` above, and draining the check-in queue alone never clears
   * it — so the dialog could sit there insisting there was unsynced work while
   * the one button offered to fix it did not touch that work.
   */
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
    /**
     * Still stuck — offline, or the server rejected something. The dialog
     * stays open rather than closing on a promise it did not keep: the user
     * can try again, or choose to lose the work deliberately.
     */
  }, [signOut]);

  const status = (field: 'weight' | 'height' | 'steps' | 'sleep' | 'water') =>
    hc.availability[field] === 'PERMISSION_DENIED' ? 'notConnected' : 'connected';

  return (
    <AppScreen
      scroll
      padded="horizontal"
      contentStyle={styles.content}
    >
      {/* Profile */}
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

      {/* Baseline — the anchor every later number is measured against */}
      <SectionCard
        icon={ChartNoAxesColumn}
        tone="user"
        title="Your baseline"
        subtitle="Used to measure progress"
      >
        {/* The whole block is the tap target — the artboard shows a chevron. */}
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

      {/* Goals — all optional */}
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

      {/* Health Connect — omitted entirely when the device has none (6b) */}
      {hcSupported ? (
        <SectionCard
          icon={Activity}
          tone="device"
          title="Health Connect"
          subtitle={
            hcProviderIssue === null ? 'Connected data types' : 'Not set up yet'
          }
          footer={
            /* No "Read-only · <time>" while the provider is unusable: we have
               never read anything, so there is no sync time to report. */
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
                  // Permissions are granted and revoked in Health Connect
                  // itself; the resume listener picks up whatever changed.
                  onPress={openHealthConnectSettings}
                  icon={ExternalLink}
                />
              </View>
            ) : undefined
          }
        >
          {hcProviderIssue !== null ? (
            /*
              Five "Not connected" rows would blame the user for a permission
              they never refused — nothing was denied, there is simply nothing
              to grant against yet. Same note-plus-link shape as the blocked
              reminder below.
            */
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
                  // A disabled provider is already part of the OS, so the Play
                  // Store has nothing to offer it.
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

      {/*
        Reminders. Off by default: the permission prompt is a cost,
        and it is only worth paying once the user has asked for the reminder.
      */}
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
                // The only way back: iOS shows its permission prompt once, so
                // asking again in here would do nothing at all.
                onPress={openNotificationSettings}
                icon={ExternalLink}
              />
            </View>
          ) : undefined
        }
      >
        {/*
          `trailing` and deliberately no `onPress`: with one, the row becomes a
          button containing a switch — two overlapping tap targets and the
          wrong role read out.

          The switch shows `reminderActive`, not the raw setting, so a refused
          permission cannot leave it claiming to be on.
        */}
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

      {/*
        Only appears when something actually failed. The app will not throw
        away what someone wrote, so a change that cannot be sent waits here
        for them to decide.
      */}
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

            {/*
              The profile sits in the same card rather than one of its own:
              to the user this is one question — "what hasn't saved?" — and
              splitting it by which slice holds the data would be the app's
              filing system leaking into the answer.
            */}
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

      {/* About */}
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
        /**
         * The way out when sync cannot succeed — offline, or the server keeps
         * refusing. Logout must not become something the user is locked out
         * of by a bad network, so this works regardless; it is destructive,
         * and the label and message both say so plainly.
         */
        secondary={{
          label: 'Log out & discard',
          destructive: true,
          onPress: () => { signOut(); },
        }}
        onCancel={() => setConfirmLogout(false)}
      />

      {/*
        Discard is destructive and, until now, invisibly so — it used to leave
        local data in place and let a later refetch quietly undo it. It applies
        immediately, so the dialog says exactly what the user will see happen.
      */}
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

      {/*
        Discarding a profile edit means adopting the server's version, which
        requires reading it — so this one cannot be honoured offline. The
        dialog says what will actually happen rather than just "discard".
      */}
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

/**
 * Names the actual outcome rather than the queue mechanics. "Discard" is
 * ambiguous on its own — it could mean the change or the entry — and for a
 * failed delete it means the opposite of what the word suggests.
 */
function discardMessage(op: PendingOp): string {
  // See discardOp: a stored op can predate `before`, and this runs at render —
  // so reading it unguarded would crash the screen as the dialog opens, before
  // the user has confirmed anything.
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
  /** Matches `reminderFooter`: the same note-above-link recovery shape. */
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
  /** Stacked, not a row: the explanation is a sentence, not a status line. */
  reminderFooter: { gap: spacing.xs, alignItems: 'flex-start' },
  logoutCard: { borderRadius: radius.card, padding: spacing.sm },
});
