import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Bell,
  MessageSquare,
  Send,
  AlertCircle,
  Check,
  X,
  Info,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  registerPushSubscription,
  unregisterPushSubscription,
} from "@/services/api";
import type { NotificationPreference, NotificationPreferenceInput } from "@/types/auth";
import {
  isPushSupported,
  getPushPermissionState,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/utils/pushNotifications";

// Available alert day options
const ALERT_DAY_OPTIONS = [1, 2, 3, 5, 7, 14];

export function NotificationPreferencesForm() {
  const { jwtToken, drepRegistration } = useAuth();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);

  // Form state
  const [discordChannelEnabled, setDiscordChannelEnabled] = useState(true);
  const [discordDmEnabled, setDiscordDmEnabled] = useState(false);
  const [webPushEnabled, setWebPushEnabled] = useState(false);
  const [discordUserId, setDiscordUserId] = useState("");
  const [alertDays, setAlertDays] = useState<number[]>([7, 3, 1]);

  // Push notification state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<PermissionState>("prompt");
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Load initial preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!jwtToken || !drepRegistration) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await getNotificationPreferences(jwtToken);
        if (response.success && response.data) {
          setPreferences(response.data);
          setDiscordChannelEnabled(response.data.discordChannelEnabled);
          setDiscordDmEnabled(response.data.discordDmEnabled);
          setWebPushEnabled(response.data.webPushEnabled);
          setDiscordUserId(response.data.discordUserId || "");
          setAlertDays(response.data.alertDays);
        }
      } catch {
        // No preferences exist yet - use defaults
        setPreferences(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [jwtToken, drepRegistration]);

  // Check push notification support
  useEffect(() => {
    const checkPushSupport = async () => {
      const supported = isPushSupported();
      setPushSupported(supported);

      if (supported) {
        const permission = await getPushPermissionState();
        setPushPermission(permission);
      }
    };

    checkPushSupport();
  }, []);

  // Toggle alert day selection
  const toggleAlertDay = (day: number) => {
    setAlertDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => b - a)
    );
  };

  // Handle web push toggle
  const handleWebPushToggle = useCallback(async () => {
    if (!jwtToken) return;

    setIsSubscribing(true);
    setError(null);

    try {
      if (!webPushEnabled) {
        // Enable push notifications
        const subscription = await subscribeToPush();
        if (subscription) {
          await registerPushSubscription(jwtToken, subscription);
          setWebPushEnabled(true);
          setPushPermission("granted");
        }
      } else {
        // Disable push notifications
        await unsubscribeFromPush();
        await unregisterPushSubscription(jwtToken);
        setWebPushEnabled(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update push subscription");
    } finally {
      setIsSubscribing(false);
    }
  }, [jwtToken, webPushEnabled]);

  // Save preferences
  const handleSave = async () => {
    if (!jwtToken) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const input: NotificationPreferenceInput = {
        discordChannelEnabled,
        discordDmEnabled,
        webPushEnabled,
        alertDays,
      };

      // Only include discordUserId if DM is enabled
      if (discordDmEnabled && discordUserId.trim()) {
        input.discordUserId = discordUserId.trim();
      }

      const response = await updateNotificationPreferences(jwtToken, input);

      if (response.success) {
        setPreferences(response.data);
        setSuccessMessage("Notification preferences saved successfully");
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  // Check if form has changes
  const hasChanges = useCallback(() => {
    if (!preferences) return true; // New preferences
    return (
      preferences.discordChannelEnabled !== discordChannelEnabled ||
      preferences.discordDmEnabled !== discordDmEnabled ||
      preferences.webPushEnabled !== webPushEnabled ||
      (preferences.discordUserId || "") !== discordUserId ||
      JSON.stringify(preferences.alertDays.sort()) !== JSON.stringify([...alertDays].sort())
    );
  }, [preferences, discordChannelEnabled, discordDmEnabled, webPushEnabled, discordUserId, alertDays]);

  if (!drepRegistration) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>You need to be a registered DRep to configure notification preferences.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (drepRegistration.status !== "APPROVED") {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
            <p>Your DRep registration is {drepRegistration.status.toLowerCase()}.</p>
            <p className="text-sm mt-2">
              Notification preferences are only available for approved DReps.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Configure how you want to be notified about upcoming voting deadlines.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Success message */}
        {successMessage && (
          <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 p-3 rounded-md">
            <Check className="w-4 h-4" />
            {successMessage}
          </div>
        )}

        {/* Alert Thresholds */}
        <div className="space-y-3">
          <Label>Alert Thresholds</Label>
          <p className="text-sm text-muted-foreground">
            Select when you want to receive deadline reminders (days before voting ends).
          </p>
          <div className="flex flex-wrap gap-2">
            {ALERT_DAY_OPTIONS.map((day) => (
              <Badge
                key={day}
                variant={alertDays.includes(day) ? "default" : "outline"}
                className={`cursor-pointer transition-colors ${
                  alertDays.includes(day)
                    ? "bg-primary hover:bg-primary/90"
                    : "hover:bg-secondary"
                }`}
                onClick={() => toggleAlertDay(day)}
              >
                {day} {day === 1 ? "day" : "days"}
                {alertDays.includes(day) && <X className="w-3 h-3 ml-1" />}
              </Badge>
            ))}
          </div>
          {alertDays.length === 0 && (
            <p className="text-sm text-yellow-500">
              Please select at least one alert threshold.
            </p>
          )}
        </div>

        {/* Notification Channels */}
        <div className="space-y-4">
          <Label>Notification Channels</Label>

          {/* Discord Channel */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-[#5865F2]" />
              <div>
                <p className="font-medium">Discord Channel</p>
                <p className="text-sm text-muted-foreground">
                  Post reminders to your proposal forum threads
                </p>
              </div>
            </div>
            <Button
              variant={discordChannelEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setDiscordChannelEnabled(!discordChannelEnabled)}
            >
              {discordChannelEnabled ? "Enabled" : "Disabled"}
            </Button>
          </div>

          {/* Discord DM */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Send className="w-5 h-5 text-[#5865F2]" />
                <div>
                  <p className="font-medium">Discord DM</p>
                  <p className="text-sm text-muted-foreground">
                    Receive direct messages on Discord
                  </p>
                </div>
              </div>
              <Button
                variant={discordDmEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setDiscordDmEnabled(!discordDmEnabled)}
              >
                {discordDmEnabled ? "Enabled" : "Enable"}
              </Button>
            </div>

            {/* Discord User ID input (shown when DM enabled) */}
            {discordDmEnabled && (
              <div className="ml-8 space-y-2">
                <Label htmlFor="discordUserId">Discord User ID</Label>
                <Input
                  id="discordUserId"
                  value={discordUserId}
                  onChange={(e) => setDiscordUserId(e.target.value)}
                  placeholder="123456789012345678"
                />
                <p className="text-xs text-muted-foreground">
                  Right-click your username in Discord and select &quot;Copy User ID&quot; (requires
                  Developer Mode).
                </p>
              </div>
            )}
          </div>

          {/* Web Push */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium">Web Push Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Receive browser notifications on this device
                </p>
              </div>
            </div>
            {pushSupported ? (
              <Button
                variant={webPushEnabled ? "default" : "outline"}
                size="sm"
                onClick={handleWebPushToggle}
                disabled={isSubscribing || pushPermission === "denied"}
              >
                {isSubscribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : webPushEnabled ? (
                  "Enabled"
                ) : (
                  "Enable"
                )}
              </Button>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Not Supported
              </Badge>
            )}
          </div>

          {/* Push permission denied warning */}
          {pushSupported && pushPermission === "denied" && (
            <div className="flex items-start gap-2 text-sm text-yellow-500 bg-yellow-500/10 p-3 rounded-md ml-8">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                Push notifications are blocked. Please enable them in your browser settings to
                receive web push alerts.
              </p>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            disabled={isSaving || alertDays.length === 0 || !hasChanges()}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
