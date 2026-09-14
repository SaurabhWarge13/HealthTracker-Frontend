import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { useTheme } from '@/hooks/useTheme';
import { layout, spacing } from '@/theme';

export type AppScreenProps = {
  children: React.ReactNode;
  edges?: readonly Edge[];
  padded?: boolean | 'horizontal';
  scroll?: boolean;
  centerContent?: boolean;
  keyboardAvoiding?: boolean;
  background?: 'background' | 'surface';
  header?: React.ReactNode;
  footer?: React.ReactNode;
  footerPlacement?: 'pinned' | 'scroll';
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

const ALL_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];

const FOOTER_BOTTOM_PADDING = 26;

export function AppScreen({
  children,
  edges = ALL_EDGES,
  padded = false,
  scroll = false,
  centerContent = false,
  keyboardAvoiding = false,
  background = 'background',
  header,
  footer,
  footerPlacement = 'pinned',
  style,
  contentStyle,
}: AppScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const padX = padded ? layout.screenPadding : 0;
  const padY = padded === true ? layout.screenPadding : 0;
  const inset = (edge: Edge) => (edges.includes(edge) ? insets[edge] : 0);

  const hasFooter = footer !== undefined;
  const footerScrolls = hasFooter && footerPlacement === 'scroll' && scroll;
  const hasPinnedFooter = hasFooter && !footerScrolls;

  const keyboardVisible = useKeyboardVisible(keyboardAvoiding && hasPinnedFooter);

  const contentBottom = () => {
    if (footerScrolls) {
      return 0;
    }
    return hasPinnedFooter ? padY : inset('bottom') + padY;
  };

  const contentInsets: ViewStyle = {
    paddingTop: header === undefined ? inset('top') + padY : padY,
    paddingBottom: contentBottom(),
    paddingLeft: inset('left') + padX,
    paddingRight: inset('right') + padX,
  };

  const body = scroll ? (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        contentStyle,
        centerContent && (footerScrolls ? styles.grow : styles.centered),
        contentInsets,
      ]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
    >
      {footerScrolls ? (
        <>
          <View style={centerContent ? styles.centeredBlock : undefined}>
            {children}
          </View>
          <View
            style={{
              paddingTop: padY,
              paddingBottom: inset('bottom') + FOOTER_BOTTOM_PADDING,
            }}
          >
            {footer}
          </View>
        </>
      ) : (
        children
      )}
    </ScrollView>
  ) : (
    <View style={[styles.root, contentStyle, contentInsets]}>{children}</View>
  );

  const inner = (
    <>
      {header !== undefined ? (
        <View style={{ paddingTop: inset('top') }}>{header}</View>
      ) : null}
      {body}
      {hasPinnedFooter ? (
        <View
          style={{
            paddingBottom: keyboardVisible
              ? spacing.sm
              : inset('bottom') + FOOTER_BOTTOM_PADDING,
            paddingLeft: inset('left') + layout.screenPadding,
            paddingRight: inset('right') + layout.screenPadding,
          }}
        >
          {footer}
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors[background] }, style]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flexGrow: 1, justifyContent: 'center' },
  grow: { flexGrow: 1 },
  centeredBlock: { flexGrow: 1, flexShrink: 0, justifyContent: 'center' },
});
