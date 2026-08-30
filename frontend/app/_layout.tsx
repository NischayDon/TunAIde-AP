import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { LibraryProvider } from "@/src/context/LibraryContext";
import { ToastProvider } from "@/src/context/ToastContext";
import { UploadProvider } from "@/src/context/UploadContext";
import { colors } from "@/src/theme";


// Disable logbox errors etc so that users can see the app
// and agent works as expected.


// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const [fontsLoaded, fontsError] = useFonts({
    "Geist-Regular": require("../assets/fonts/Geist-Regular.ttf"),
    "Geist-Medium": require("../assets/fonts/Geist-Medium.ttf"),
    "Geist-SemiBold": require("../assets/fonts/Geist-SemiBold.ttf"),
    "Geist-Bold": require("../assets/fonts/Geist-Bold.ttf"),
  });

  const iconsReady = loaded || error;
  const textReady = fontsLoaded || !!fontsError;

  useEffect(() => {
    if (iconsReady && textReady) {
      SplashScreen.hideAsync();
    }
  }, [iconsReady, textReady]);

  // If the CDN is unreachable we fall through on error rather than wedging
  // the app — icons will tofu, but the app still boots.
  if (!iconsReady || !textReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <ToastProvider>
            <LibraryProvider>
              <UploadProvider>
                <StatusBar style="dark" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.surface },
                  }}
                >
                  <Stack.Screen name="index" />
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="permissions" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="category/[key]" />
                  <Stack.Screen name="audio/[id]" />
                  <Stack.Screen name="push-config" options={{ presentation: "modal" }} />
                  <Stack.Screen name="queue" />
                  <Stack.Screen name="success" />
                  <Stack.Screen name="settings" />
                </Stack>
              </UploadProvider>
            </LibraryProvider>
          </ToastProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
