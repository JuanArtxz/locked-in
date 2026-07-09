const APP_NAMES: Record<string, string> = {
  'robloxstudiobeta.exe': 'Roblox Studio',
  'robloxplayerbeta.exe': 'Roblox Player',
  'code.exe': 'VS Code',
  'chrome.exe': 'Chrome',
  'msedge.exe': 'Edge',
  'brave.exe': 'Brave',
  'firefox.exe': 'Firefox',
  'discord.exe': 'Discord',
  'spotify.exe': 'Spotify',
  'explorer.exe': 'Explorer',
  'windowsterminal.exe': 'Terminal',
  'obsidian.exe': 'Obsidian',
  'notion.exe': 'Notion',
  'blender.exe': 'Blender',
  'photoshop.exe': 'Photoshop',
  'figma.exe': 'Figma',
  'steam.exe': 'Steam',
  'whatsapp.exe': 'WhatsApp',
  'obs64.exe': 'OBS',
  'capcut.exe': 'CapCut',
  'app.exe': 'Locked In',
  'locked in.exe': 'Locked In',
};

export function friendlyAppName(exe: string): string {
  const known = APP_NAMES[exe.toLowerCase()];
  if (known) return known;
  const base = exe.replace(/\.exe$/i, '');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function parseAppUsage(json: string | null): { name: string; sec: number }[] {
  if (!json) return [];
  try {
    const obj = JSON.parse(json) as Record<string, number>;
    return Object.entries(obj)
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec);
  } catch {
    return [];
  }
}
