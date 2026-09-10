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
  /** Which safe-area edges to respect. Drop 'top' under a custom header band. */
  edges?: readonly Edge[];
  /**
   * Standard screen padding (14) inside the insets.
   * `true` pads all four sides; `'horizontal'` pads left/right only, which is
   * what a screen with its own header wants — the header supplies the top gap.
   *
   * Page padding must come from here, NOT from `contentStyle`: the insets set
   * paddingLeft/paddingRight explicitly, and in Yoga those resolve above a
   * `paddingHorizontal` coming from anywhere else.
   */
  padded?: boolean | 'horizontal';
  /** Wraps content in a ScrollView. */
  scroll?: boolean;
  /** Vertically centres the scroll content (Focus archetype: login, onboarding). */
  centerContent?: boolean;
  /** Wraps everything in a KeyboardAvoidingView so pinned actions stay visible. */
  keyboardAvoiding?: boolean;
  background?: 'background' | 'surface';
  /** Rendered above the top inset, outside the scroll area (screen headers). */
  header?: React.ReactNode;
  /** Pinned to the bottom, outside the scroll area, above the keyboard. */
  footer?: React.ReactNode;
  /**
   * Where the footer sits.
   * `'pinned'` (default) keeps it outside the ScrollView and above the
   * keyboard — right for a primary action the user needs while typing.
   * `'scroll'` makes it the last item of the scroll content, so the keyboard
   * covers it like any other content — right for a secondary link.
   */
  footerPlacement?: 'pinned' | 'scroll';
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

const ALL_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];

/** Extra breathing room under a pinned footer, per the artboards. */
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
  /** A scrolling footer is content, so it only makes sense inside a ScrollView. */
  const footerScrolls = hasFooter && footerPlacement === 'scroll' && scroll;
  const hasPinnedFooter = hasFooter && !footerScrolls;

  /**
   * Only a pinned footer under a keyboard avoider can strand padding above
   * the keyboard, so nothing else pays for the subscription.
   */
  const keyboardVisible = useKeyboardVisible(keyboardAvoiding && hasPinnedFooter);

  /**
   * With a pinned footer, the bottom inset belongs to the footer, not the
   * content. A scrolling footer is the content's own last child, so it carries
   * the whole bottom gap itself and the container adds nothing under it.
   */
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

  // contentStyle comes FIRST so the safe-area insets always win — a caller
  // cannot accidentally paint over them (see the `padded` note above).
  const body = scroll ? (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        contentStyle,
        // With a scrolling footer the centring moves onto the wrapper below,
        // so the footer stays at the bottom instead of being centred with it.
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
          {/* Same gaps the pinned footer gets, so the resting layout is unchanged. */}
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
            /**
             * The bottom inset reserves room for the home indicator, which
             * the keyboard covers. Holding on to it while the keyboard is up
             * leaves a dead strip between the keyboard and the action — most
             * visible on Goals, whose footer stacks two buttons.
             */
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
  /**
   * Fills whatever the footer leaves and centres the page inside it.
   * `flexShrink: 0` matters: when the keyboard shrinks the scroll viewport the
   * block must overflow into a scroll, not squash the form.
   */
  centeredBlock: { flexGrow: 1, flexShrink: 0, justifyContent: 'center' },
});
