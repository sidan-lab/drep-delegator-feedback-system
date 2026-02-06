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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/services/api";
import type { NotificationPreference, NotificationPreferenceInput } from "@/types/auth";

// Available alert day options (1-14 days)
const ALERT_DAY_OPTIONS = Array.from({ length: 14 }, (_, i) => i + 1); // [1, 2, 3, ..., 14]

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
  const [inAppToastEnabled, setInAppToastEnabled] = useState(true);
  const [discordUserId, setDiscordUserId] = useState("");
  const [alertDays, setAlertDays] = useState<number[]>([7, 3, 1]);

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
          setInAppToastEnabled(response.data.inAppToastEnabled ?? true);
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

  // Toggle alert day selection
  const toggleAlertDay = (day: number) => {
    setAlertDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => b - a)
    );
  };

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
        inAppToastEnabled,
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
      (preferences.inAppToastEnabled ?? true) !== inAppToastEnabled ||
      (preferences.discordUserId || "") !== discordUserId ||
      JSON.stringify(preferences.alertDays.sort()) !== JSON.stringify([...alertDays].sort())
    );
  }, [preferences, discordChannelEnabled, discordDmEnabled, inAppToastEnabled, discordUserId, alertDays]);

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

          {/* In-App Toast Notifications */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium">In-App Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Receive toast notifications while browsing the site
                </p>
              </div>
            </div>
            <Button
              variant={inAppToastEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setInAppToastEnabled(!inAppToastEnabled)}
            >
              {inAppToastEnabled ? "Enabled" : "Disabled"}
            </Button>
          </div>
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
