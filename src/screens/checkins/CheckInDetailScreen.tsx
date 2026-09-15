import React, { useCallback, useRef, useState } from 'react';
import {
  InteractionManager,
  Share,
  StyleSheet,
  View,
  type View as RNView,
} from 'react-native';
import {
  Activity,
  AlignLeft,
  Droplet,
  MoreVertical,
  Moon,
  Pencil,
  Ruler,
  Share2,
  Trash2,
} from 'lucide-react-native';
import { AppDivider, AppIcon, AppScreen, AppText } from '@/components/common';
import { CheckInMissingCard, moodIcon } from '@/components/checkins';
import { DeltaBadge, MeasurementRow } from '@/components/data';
import { ScreenHeader, SectionCard } from '@/components/layout';
import { AppDialog, PopoverMenu, type PopoverAnchor } from '@/components/overlays';
import {
  ACTION_LABEL,
  CHECK_IN,
  DELETE_CHECKIN_TITLE,
  FIELD_LABEL,
  MEASUREMENTS_SUBTITLE,
  MEASUREMENTS_TITLE,
  NOT_SET,
  UNIT,
  deleteCheckInMessage,
} from '@/content';
import { buildCheckInLink } from '@/navigation/deepLinks';
import {
  selectCheckInById,
  selectPreviousCheckIn,
} from '@/store/checkins/checkinsSelectors';
import { deleteCheckIn } from '@/store/checkins/checkinsCommands';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useTheme } from '@/hooks/useTheme';
import { layout, radius, spacing } from '@/theme';
import {
  formatDuration,
  formatLongDateTime,
  formatSteps,
  formatWater,
  formatWeight,
} from '@/utils/formatters';
import type { MainStackScreenProps } from '@/types/navigation';

export function CheckInDetailScreen({
  navigation,
  route,
}: MainStackScreenProps<'CheckInDetail'>) {
  const { id } = route.params;
  const dispatch = useAppDispatch();
  const { colors } = useTheme();

  const checkIn = useAppSelector(selectCheckInById(id));
  const previous = useAppSelector(selectPreviousCheckIn(id));

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const menuButtonRef = useRef<RNView>(null);

  const openMenu = useCallback(() => {
    menuButtonRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setMenuOpen(true);
    });
  }, []);

  const handleShare = useCallback(() => {
    setMenuOpen(false);
    InteractionManager.runAfterInteractions(() => {
      Share.share({ message: buildCheckInLink(id) }).catch(() => {});
    });
  }, [id]);

  const handleDelete = useCallback(() => {
    setConfirmDelete(false);
    dispatch(deleteCheckIn(id));
    navigation.goBack();
  }, [dispatch, id, navigation]);

  if (checkIn === null) {
    return (
      <AppScreen
        padded
        header={
          <ScreenHeader variant="nav" title={CHECK_IN} onBack={navigation.goBack} />
        }
      >
        <CheckInMissingCard
          onBackToHistory={() => navigation.navigate('Tabs', { screen: 'History' })}
        />
      </AppScreen>
    );
  }

  const deltaKg =
    previous === null ? null : checkIn.weightKg - previous.weightKg;

  return (
    <AppScreen
      scroll
      padded="horizontal"
      header={
        <ScreenHeader
          variant="nav"
          title={CHECK_IN}
          onBack={navigation.goBack}
          actionIcon={MoreVertical}
          actionIconLabel={ACTION_LABEL.moreOptions}
          onAction={openMenu}
          actionRef={menuButtonRef}
        />
      }
      contentStyle={styles.content}
    >
      <View style={[styles.summary, { backgroundColor: colors.surface }]}>
        <View style={styles.summaryText}>
          <View style={styles.weightRow}>
            <AppText variant="hero" numeric>
              {formatWeight(checkIn.weightKg)}
            </AppText>
            <AppText variant="body" color="textMuted">
              {UNIT.kg}
            </AppText>
          </View>

          <AppText variant="bodySmall" color="textMuted">
            {formatLongDateTime(checkIn.createdAt)}
          </AppText>

          {deltaKg !== null ? (
            <DeltaBadge deltaKg={deltaKg} suffix="kg from last" />
          ) : null}
        </View>

        <View style={[styles.moodCircle, { backgroundColor: colors.userTint }]}>
          <AppIcon icon={moodIcon(checkIn.mood)} size="xl" color="userAccent" />
        </View>
      </View>

      <SectionCard
        icon={Activity}
        tone="device"
        title={MEASUREMENTS_TITLE}
        subtitle={MEASUREMENTS_SUBTITLE}
        bodyPadding={false}
      >
        <View style={styles.rows}>
          {checkIn.steps !== null ? (
            <>
              <MeasurementRow
                icon={Activity}
                label={FIELD_LABEL.steps}
                value={formatSteps(checkIn.steps)}
                source={checkIn.sources.steps}
              />
              <AppDivider inset={32} />
            </>
          ) : null}

          {checkIn.sleepMinutes !== null ? (
            <>
              <MeasurementRow
                icon={Moon}
                label={FIELD_LABEL.sleep}
                value={formatDuration(checkIn.sleepMinutes)}
                source={checkIn.sources.sleep}
              />
              <AppDivider inset={32} />
            </>
          ) : null}

          {checkIn.waterMl !== null ? (
            <>
              <MeasurementRow
                icon={Droplet}
                label={FIELD_LABEL.water}
                value={formatWater(checkIn.waterMl)}
                source={checkIn.sources.water}
              />
              <AppDivider inset={32} />
            </>
          ) : null}

          <MeasurementRow
            icon={Ruler}
            label={FIELD_LABEL.height}
            value={checkIn.heightCm === null ? NOT_SET : `${checkIn.heightCm} ${UNIT.cm}`}
            source={checkIn.heightCm === null ? undefined : 'manual'}
          />
        </View>
      </SectionCard>

      <SectionCard
        icon={AlignLeft}
        tone="user"
        title="Notes"
        subtitle="Written by you"
      >
        <AppText
          variant="body"
          color={checkIn.notes.trim() === '' ? 'textHint' : 'textPrimary'}
        >
          {checkIn.notes.trim() === '' ? 'No notes added' : checkIn.notes}
        </AppText>
      </SectionCard>

      <PopoverMenu
        visible={menuOpen}
        anchor={anchor}
        onDismiss={() => setMenuOpen(false)}
        items={[
          {
            label: 'Share',
            icon: Share2,
            onPress: handleShare,
          },
          {
            label: 'Edit',
            icon: Pencil,
            onPress: () => {
              setMenuOpen(false);
              navigation.navigate('CheckInForm', { id });
            },
          },
          {
            label: ACTION_LABEL.delete,
            icon: Trash2,
            destructive: true,
            onPress: () => {
              setMenuOpen(false);
              setConfirmDelete(true);
            },
          },
        ]}
      />

      <AppDialog
        visible={confirmDelete}
        title={DELETE_CHECKIN_TITLE}
        message={deleteCheckInMessage(formatLongDateTime(checkIn.createdAt))}
        confirm={{ label: ACTION_LABEL.delete, onPress: handleDelete, destructive: true }}
        onCancel={() => setConfirmDelete(false)}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: layout.screenPadding, gap: layout.screenPadding },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radius.card,
    paddingVertical: spacing.lg + spacing.xs,
    paddingHorizontal: layout.cardPadding,
  },
  summaryText: { flex: 1, gap: 6, alignItems: 'flex-start' },
  weightRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  moodCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rows: { paddingHorizontal: layout.cardPadding, paddingVertical: spacing.sm, gap: 14 },
});
