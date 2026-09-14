/// Embeds a public meet.jit.si room via a plain iframe — no SDK/script and
/// no account or API key needed, matching the "Jitsi embed" decision for
/// Classroom video. `roomName` should already be namespaced (see
/// lib/classroom.ts `jitsiRoomName`) so it doesn't collide with a
/// stranger's public room of the same name.
export function JitsiEmbed({ roomName, displayName }: { roomName: string; displayName: string }) {
  const nameParam = encodeURIComponent(`"${displayName.replace(/"/g, '')}"`);
  const src = `https://meet.jit.si/${encodeURIComponent(roomName)}#userInfo.displayName=${nameParam}&config.prejoinPageEnabled=false`;

  return (
    <iframe
      title="Classroom video"
      src={src}
      allow="camera; microphone; display-capture; fullscreen; autoplay"
      style={{ width: '100%', height: '100%', minHeight: 260, border: 'none', borderRadius: 8 }}
    />
  );
}
