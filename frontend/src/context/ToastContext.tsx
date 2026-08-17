import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, font, radius, spacing, type } from '@/src/theme';

type ToastType = 'info' | 'success' | 'error';

interface ToastCtx { showToast: (message: string, kind?: ToastType) => void }

const Ctx = createContext<ToastCtx>({ showToast: () => {} });

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; kind: ToastType } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, kind: ToastType = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, kind });
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true })
        .start(() => setToast(null));
    }, 3000);
  }, [opacity]);

  const iconFor: Record<ToastType, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
    info: { name: 'information-circle', color: colors.brand2 },
    success: { name: 'checkmark-circle', color: colors.success },
    error: { name: 'alert-circle', color: colors.error },
  };

  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[styles.wrap, { top: insets.top + spacing.md, opacity }]}
        >
          <View style={styles.toast} testID="toast-message">
            <Ionicons name={iconFor[toast.kind].name} size={18} color={iconFor[toast.kind].color} />
            <Text style={styles.text} numberOfLines={2}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center', zIndex: 9999 },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface3, borderColor: colors.border, borderWidth: 1,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md,
    maxWidth: 480,
  },
  text: { color: colors.onSurface, fontFamily: font.medium, fontSize: type.base, flexShrink: 1 },
});
