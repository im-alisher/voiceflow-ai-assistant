/**
 * Route path constants.
 *
 * Every `to=` in the app points here, so a route rename is a compile error
 * rather than a silently broken navigation.
 */
export const ROUTES = {
  root: '/',
  dashboard: '/dashboard',
  chat: '/chat',
  conversation: (id: string) => `/chat/${id}`,
  settings: '/settings',
  settingsGeneral: '/settings/general',
  settingsVoice: '/settings/voice',
  settingsAppearance: '/settings/appearance',
  settingsAccount: '/settings/account',
  voiceLab: '/voice',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
