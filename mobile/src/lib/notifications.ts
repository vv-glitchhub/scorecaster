import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { apiRequest } from "./api";

const DEVICE_ID_KEY = "scorecaster.notificationDeviceId";
const CHANNEL_ID = "scorecaster-alerts";

export type NotificationPreferences = {
  in_app_enabled: boolean;
  push_enabled: boolean;
  high_enabled: boolean;
  medium_enabled: boolean;
  info_enabled: boolean;
  kickoff_enabled: boolean;
  decision_enabled: boolean;
  price_enabled: boolean;
};

export type NotificationDevice = {
  id: string;
  platform: "ios" | "android";
  app_version?: string | null;
  build_version?: string | null;
  enabled: boolean;
  last_seen_at: string;
  created_at: string;
};

export type NotificationRegistry = {
  ok: boolean;
  available: boolean;
  deliveryActive: boolean;
  deliveryConfigured?: boolean;
  deliverySchedulingManagedExternally?: boolean;
  warning?: string | null;
  deviceId?: string;
  preferences: NotificationPreferences;
  devices: NotificationDevice[];
};

function projectId() {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const value = extra?.eas?.projectId || Constants.easConfig?.projectId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function permissionGranted(status: Notifications.NotificationPermissionsStatus) {
  return status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

async function prepareAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Scorecaster alerts",
    description: "User-selected Watchlist and Alert Inbox notifications",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 200, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE
  });
}

export async function loadNotificationRegistry() {
  return apiRequest<NotificationRegistry>("/api/cloud/notifications");
}

export async function updateNotificationPreferences(changes: Partial<NotificationPreferences>) {
  const { push_enabled: _ignored, ...editable } = changes;
  return apiRequest<NotificationRegistry>("/api/cloud/notifications", { method: "PUT", body: editable });
}

export async function registerNotificationDevice() {
  if (Platform.OS !== "ios" && Platform.OS !== "android") throw new Error("Push notifications require the native iOS or Android application.");
  await prepareAndroidChannel();
  let permissions = await Notifications.getPermissionsAsync();
  if (!permissionGranted(permissions)) permissions = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  if (!permissionGranted(permissions)) throw new Error("Notification permission was not granted on this device.");
  const easProjectId = projectId();
  if (!easProjectId) throw new Error("The EAS project ID is not configured. Device registration remains disabled.");
  const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;
  const response = await apiRequest<NotificationRegistry>("/api/cloud/notifications", {
    method: "POST",
    timeoutMs: 30000,
    body: { expoPushToken, platform: Platform.OS, appVersion: Constants.expoConfig?.version || null, buildVersion: null }
  });
  if (!response.deviceId) throw new Error("The server did not return a notification device ID.");
  await SecureStore.setItemAsync(DEVICE_ID_KEY, response.deviceId, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return response;
}

export async function unregisterNotificationDevice() {
  const id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) return loadNotificationRegistry();
  const response = await apiRequest<NotificationRegistry>("/api/cloud/notifications", { method: "DELETE", body: { id } });
  await SecureStore.deleteItemAsync(DEVICE_ID_KEY);
  return response;
}

export async function localNotificationDeviceId() {
  return SecureStore.getItemAsync(DEVICE_ID_KEY);
}
