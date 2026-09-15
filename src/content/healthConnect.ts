import type { ProviderIssue } from '@/domain/healthConnect/provider';

export const HEALTH_CONNECT_LABEL = 'Health Connect';
export const CHECKING_LABEL = 'Checking Health Connect…';

export const PROVIDER_ACTION: Record<ProviderIssue, string> = {
  missing: 'Get Health Connect',
  disabled: 'Open settings',
  updateRequired: 'Update Health Connect',
};

export const PROVIDER_ISSUE_COPY: Record<
  ProviderIssue,
  { note: string; action: string }
> = {
  missing: {
    note: "Health Connect isn't installed on this phone, so there is nothing to read from yet.",
    action: PROVIDER_ACTION.missing,
  },
  disabled: {
    note: 'Health Connect is turned off on this phone, so this app cannot read from it.',
    action: PROVIDER_ACTION.disabled,
  },
  updateRequired: {
    note: 'Health Connect needs an update before this app can read from it.',
    action: PROVIDER_ACTION.updateRequired,
  },
};

export const PROVIDER_SETUP_COPY: Record<
  ProviderIssue,
  { body: string; action: string }
> = {
  missing: {
    body: "Health Connect isn't installed on this phone. Get it free and your steps, sleep and water track themselves.",
    action: PROVIDER_ACTION.missing,
  },
  disabled: {
    body: 'Health Connect is turned off on this phone. Turn it back on and your steps, sleep and water track themselves.',
    action: PROVIDER_ACTION.disabled,
  },
  updateRequired: {
    body: 'Health Connect needs an update before this app can read your steps, sleep and water.',
    action: PROVIDER_ACTION.updateRequired,
  },
};
