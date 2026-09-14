import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Activity, Moon, Ruler, Smile, Trash2, X } from 'lucide-react-native';
import { AppButton, AppDivider, AppIcon, AppScreen } from '@/components/common';
import { MeasurementField, MoodPicker } from '@/components/checkins';
import { MeasurementRow } from '@/components/data';
import { ControlledInput } from '@/components/forms';
import { ScreenHeader, SectionCard, StickyFooter } from '@/components/layout';
import { AppDialog } from '@/components/overlays';
import { useKeyboardSafeNav } from '@/hooks';
import type { CheckInSources, Mood, SourcedField } from '@/domain/checkins/types';
import {
  checkInSchema,
  type CheckInPayload,
  type CheckInValues,
} from '@/domain/checkins/validation';
import { litresToMl, mlToLitres } from '@/domain/profile/validation';
import {
  selectCheckInById,
  selectLatestCheckIn,
} from '@/store/checkins/checkinsSelectors';
import {
  createCheckIn,
  deleteCheckIn,
  updateCheckIn,
} from '@/store/checkins/checkinsCommands';
import { shouldPrefillWeight } from '@/domain/healthConnect/freshness';
import { selectHealthConnect } from '@/store/healthConnect/healthConnectSelectors';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectProfile } from '@/store/profile/profileSelectors';
import { layout, spacing } from '@/theme';
import {
  formatDuration,
  formatLongDateTime,
  formatSteps,
  formatWeightWithUnit,
} from '@/utils/formatters';
import type { MainStackScreenProps } from '@/types/navigation';

export function CheckInFormScreen({
  navigation,
  route,
}: MainStackScreenProps<'CheckInForm'>) {
  const dispatch = useAppDispatch();
  const editingId = route.params?.id;
  const isEditing = editingId !== undefined;

  const existing = useAppSelector(selectCheckInById(editingId ?? ''));
  const latest = useAppSelector(selectLatestCheckIn);
  const profile = useAppSelector(selectProfile);
  const hc = useAppSelector(selectHealthConnect);
  const safeNav = useKeyboardSafeNav();

  const [mood, setMood] = useState<Mood | null>(existing?.mood ?? null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [edited, setEdited] = useState<Set<SourcedField>>(new Set());

  const prefill = useMemo(() => {
    if (isEditing && existing) {
      return {
        weight: String(existing.weightKg),
        steps: existing.steps === null ? '' : String(existing.steps),
        sleep:
          existing.sleepMinutes === null ? '' : formatDuration(existing.sleepMinutes),
        water: existing.waterMl === null ? '' : String(mlToLitres(existing.waterMl)),
        height: existing.heightCm === null ? '' : String(existing.heightCm),
        notes: existing.notes,
        sources: existing.sources,
      };
    }

    const hcWeightIsFresher =
      hc.today.weightKg !== null &&
      shouldPrefillWeight(
        hc.today.weightRecordedAt,
        latest === null ? null : latest.createdAt,
        Date.now(),
      );

    const sources: CheckInSources = {};
    if (hcWeightIsFresher) {
      sources.weight = 'healthConnect';
    }
    if (hc.today.steps !== null) {
      sources.steps = 'healthConnect';
    }
    if (hc.today.sleepMinutes !== null) {
      sources.sleep = 'healthConnect';
    }
    if (hc.today.waterMl !== null) {
      sources.water = 'healthConnect';
    }

    return {
      weight: hcWeightIsFresher
        ? String(hc.today.weightKg)
        : latest !== null
        ? String(latest.weightKg)
        : '',
      steps: hc.today.steps === null ? '' : String(hc.today.steps),
      sleep:
        hc.today.sleepMinutes === null ? '' : formatDuration(hc.today.sleepMinutes),
      water: hc.today.waterMl === null ? '' : String(mlToLitres(hc.today.waterMl)),
      height: profile.heightCm === null ? '' : String(profile.heightCm),
      notes: '',
      sources,
    };
  }, [existing, hc, isEditing, latest, profile.heightCm]);

  const { control, handleSubmit, formState } = useForm<
    CheckInValues,
    unknown,
    CheckInPayload
  >({
    resolver: zodResolver(checkInSchema),
    mode: 'onChange',
    defaultValues: {
      weight: prefill.weight,
      steps: prefill.steps,
      sleep: prefill.sleep,
      water: prefill.water,
      height: prefill.height,
      notes: prefill.notes,
    },
  });

  const sourceFor = useCallback(
    (field: SourcedField) =>
      edited.has(field) ? ('manual' as const) : prefill.sources[field],
    [edited, prefill.sources],
  );

  const markEdited = useCallback(
    (field: SourcedField) =>
      setEdited(previous => {
        if (previous.has(field)) {
          return previous;
        }
        const next = new Set(previous);
        next.add(field);
        return next;
      }),
    [],
  );

  const onSubmit = useCallback(
    (values: CheckInPayload) => {
      const sources: CheckInSources = {
        weight: sourceFor('weight'),
        steps: sourceFor('steps'),
        sleep: sourceFor('sleep'),
        water: sourceFor('water'),
      };

      const draft = {
        weightKg: values.weight,
        heightCm: values.height ?? profile.heightCm,
        steps: values.steps ?? null,
        sleepMinutes: values.sleep ?? null,
        waterMl: values.water === undefined ? null : litresToMl(values.water),
        mood,
        notes: values.notes.trim(),
        sources,
      };

      safeNav(() => {
        if (isEditing && editingId !== undefined) {
          dispatch(updateCheckIn(editingId, draft));
        } else {
          dispatch(createCheckIn(draft));
        }
        navigation.goBack();
      });
    },
    [
      dispatch,
      editingId,
      isEditing,
      mood,
      navigation,
      profile.heightCm,
      safeNav,
      sourceFor,
    ],
  );

  const handleDelete = useCallback(() => {
    setConfirmDelete(false);
    safeNav(() => {
      if (editingId !== undefined) {
        dispatch(deleteCheckIn(editingId));
      }
      navigation.navigate('Tabs', { screen: 'History' });
    });
  }, [dispatch, editingId, navigation, safeNav]);

  const subtitle = isEditing
    ? existing
      ? formatLongDateTime(existing.createdAt)
      : ''
    : formatLongDateTime(Date.now());

  return (
    <AppScreen
      scroll
      padded="horizontal"
      keyboardAvoiding
      header={
        <ScreenHeader
          variant="modal"
          title={isEditing ? 'Edit check-in' : 'New check-in'}
          subtitle={subtitle}
          onBack={() => safeNav(navigation.goBack)}
          backIcon={X}
          backAccessibilityLabel="Close without saving"
          actionIcon={isEditing ? Trash2 : undefined}
          actionIconLabel="Delete this check-in"
          onAction={isEditing ? () => setConfirmDelete(true) : undefined}
        />
      }
      footer={
        <StickyFooter>
          <AppButton
            label={isEditing ? 'Save changes' : 'Save check-in'}
            size={52}
            fullWidth
            disabled={!formState.isValid}
            onPress={handleSubmit(onSubmit)}
          />
        </StickyFooter>
      }
      contentStyle={styles.content}
    >
      <SectionCard
        icon={Activity}
        tone="device"
        title="Measurements"
        subtitle={
          isEditing ? 'As recorded at the time' : 'Prefilled where available'
        }
      >
        <View style={styles.fields}>
          <MeasurementField
            control={control}
            name="weight"
            label="Weight"
            source={sourceFor('weight')}
            suffix="kg"
            placeholder="72.0"
            size="lg"
            onValueChange={() => markEdited('weight')}
            helper={
              latest !== null && !isEditing
                ? `Last check-in: ${formatWeightWithUnit(latest.weightKg)}`
                : undefined
            }
          />

          <MeasurementField
            control={control}
            name="steps"
            label="Steps"
            source={sourceFor('steps')}
            valueSize="body"
            suffix="steps"
            placeholder={formatSteps(8000)}
            keyboardType="number-pad"
            size="md"
            onValueChange={() => markEdited('steps')}
          />

          <MeasurementField
            control={control}
            name="sleep"
            label="Sleep"
            source={sourceFor('sleep')}
            valueSize="body"
            trailing={<AppIcon icon={Moon} size="base" color="textHint" />}
            placeholder="7h 30m"
            keyboardType="default"
            size="md"
            helper="Up to 24h"
            onValueChange={() => markEdited('sleep')}
          />

          <MeasurementField
            control={control}
            name="water"
            label="Water"
            source={sourceFor('water')}
            valueSize="body"
            suffix="L"
            placeholder="2.0"
            size="md"
            onValueChange={() => markEdited('water')}
          />

          <AppDivider style={styles.heightDivider} />
          <MeasurementRow
            icon={Ruler}
            label="Height"
            value={
              profile.heightCm === null ? 'Not set' : `${profile.heightCm} cm`
            }
            actionLabel="Change"
            onAction={() =>
              safeNav(() => navigation.navigate('Tabs', { screen: 'Settings' }))
            }
          />
        </View>
      </SectionCard>

      <SectionCard
        icon={Smile}
        tone="user"
        title="How are you feeling"
        subtitle="Optional"
      >
        <MoodPicker value={mood} onChange={setMood} />

        <ControlledInput
          control={control}
          name="notes"
          label="Notes"
          placeholder="Anything worth remembering about today?"
          multiline
          containerStyle={styles.notes}
        />
      </SectionCard>

      <AppDialog
        visible={confirmDelete}
        title="Delete this check-in?"
        message={
          existing
            ? `The entry from ${formatLongDateTime(
                existing.createdAt,
              )} will be removed from your history. This can't be undone.`
            : "This entry will be removed from your history. This can't be undone."
        }
        confirm={{ label: 'Delete', onPress: handleDelete, destructive: true }}
        onCancel={() => setConfirmDelete(false)}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: layout.screenPadding, gap: layout.screenPadding },
  fields: { gap: 18 },
  heightDivider: { marginTop: spacing.xs },
  notes: { marginTop: 18 },
});
