export function getGoogleMeetId(meetUrl: string): string {
  const match = meetUrl.match(/meet\.google\.com\/([a-z\-]+)/i);
  if (!match) {
    throw new Error(`Invalid Google Meet URL: ${meetUrl}`);
  }

  // qnh-vezo-vkq → qnh_vezo_vkq
  return `g_meet_${match[1].replace(/-/g, '_')}`;
}