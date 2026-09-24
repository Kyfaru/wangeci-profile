"use client";

import { useState, type FormEvent } from "react";
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  FormField,
  Input,
} from "@/components/ui";

export interface SettingsFormProps {
  name: string;
  email: string;
  avatar?: string;
}

/**
 * `/dashboard/settings` form. Client component so the fields are editable
 * and a "Saved" confirmation can appear on submit — nothing here actually
 * persists (no settings-update Route Handler exists in `app/api/**`, and
 * adding one is out of scope for this build), matching the brief's "doesn't
 * need to actually persist anything, just render a plausible settings UI."
 *
 * Deliberately no password field anywhere (this app is passwordless — see
 * plan §2A). The "authenticator app" row is a static, unwired `Button`: the
 * `TwoFactorModal` enrollment mode it would eventually open is explicitly
 * flagged in the brief as out of scope to wire up here.
 */
export function SettingsForm({ name, email, avatar }: SettingsFormProps) {
  const [formName, setFormName] = useState(name);
  const [formEmail, setFormEmail] = useState(email);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [productUpdates, setProductUpdates] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavedAt(Date.now());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <Card padding="lg" className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Avatar src={avatar} alt={name} size="lg" />
          <div>
            <p className="font-display text-lg text-navy">{name}</p>
            <p className="text-sm text-gray">{email}</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="settings-name" label="Full name">
            <Input
              id="settings-name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              autoComplete="name"
            />
          </FormField>
          <FormField id="settings-email" label="Email address">
            <Input
              id="settings-email"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              autoComplete="email"
            />
          </FormField>
        </div>
      </Card>

      <Card padding="lg" className="flex flex-col gap-4">
        <h2 className="font-display text-lg text-navy">
          Notification preferences
        </h2>
        <Checkbox
          checked={emailNotifications}
          onChange={(e) => setEmailNotifications(e.target.checked)}
          label="Email me about new chapters and replies"
        />
        <Checkbox
          checked={productUpdates}
          onChange={(e) => setProductUpdates(e.target.checked)}
          label="Send product updates and announcements"
        />
        <Checkbox
          checked={smsNotifications}
          onChange={(e) => setSmsNotifications(e.target.checked)}
          label="SMS notifications for order updates"
        />
      </Card>

      <Card padding="lg" className="flex flex-col gap-3">
        <h2 className="font-display text-lg text-navy">Security</h2>
        <p className="text-sm text-gray">
          This account is passwordless — sign-in uses a one-time code sent to
          your email or phone. Add an authenticator app for a faster,
          offline-friendly second factor.
        </p>
        <Button type="button" variant="outline" size="sm" className="w-fit">
          Set up authenticator app
        </Button>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" variant="primary">
          Save changes
        </Button>
        {savedAt && (
          <span className="text-sm text-green">Settings saved.</span>
        )}
      </div>
    </form>
  );
}
