/**
 * Platform Detection
 * Detects client platform from request headers
 */

import type { Request } from 'express';
import type { Platform, PlatformContext } from '../models/types.js';

/**
 * Detect the platform context from the request
 * Uses origin, user-agent, and referrer to determine platform
 */
export function detectPlatform(req: Request): PlatformContext {
  const userAgent = req.headers['user-agent'] || '';
  const origin = req.headers.origin || '';
  const referrer = req.headers.referer || '';
  const frameAncestor = req.query.frame_id as string | undefined;

  // Check for Discord Activity context
  const isDiscordActivity =
    origin.includes('discordsays.com') ||
    origin.includes('discord.com') ||
    referrer.includes('discord.com') ||
    !!frameAncestor; // Discord passes frame_id query param

  // Mobile detection
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  const isMobile = isIOS || isAndroid;

  // Determine platform
  let platform: Platform = 'web';
  if (isDiscordActivity) {
    platform = 'discord';
  } else if (isIOS) {
    platform = 'ios';
  } else if (isAndroid) {
    platform = 'android';
  }

  return {
    platform,
    isDiscordActivity,
    isMobile,
    userAgent,
    origin,
  };
}
