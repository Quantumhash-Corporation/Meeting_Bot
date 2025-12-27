import { execSync } from 'child_process';

/**
 * RULES (NON-NEGOTIABLE):
 * 1. ❌ NEVER touch system default sink
 * 2. ✅ Each meeting gets its OWN null sink
 * 3. ✅ Sink lifecycle = meeting lifecycle
 * 4. ✅ No ref-count, no restore, no global state
 */

function sinkExists(sinkName: string): boolean {
  const sinks = execSync('pactl list short sinks').toString();
  return sinks.includes(sinkName);
}

function getModuleIdBySink(sinkName: string): string | null {
  const modules = execSync('pactl list short modules').toString();
  const line = modules
    .split('\n')
    .find(l => l.includes(`sink_name=${sinkName}`));

  return line ? line.split('\t')[0] : null;
}

/* =========================
   CREATE ISOLATED SINK
   ========================= */
export function createSink(meetingId: string): string {
  const sinkName = `g_meet_${meetingId}`;

  if (!sinkExists(sinkName)) {
    execSync(
      `pactl load-module module-null-sink sink_name=${sinkName} sink_properties=device.description=${sinkName}`,
      { stdio: 'ignore' }
    );
  }

  return sinkName;
}

/* =========================
   REMOVE ISOLATED SINK
   ========================= */
export function removeSink(sinkName: string) {
  try {
    const moduleId = getModuleIdBySink(sinkName);
    if (moduleId) {
      execSync(`pactl unload-module ${moduleId}`, { stdio: 'ignore' });
    }
  } catch {
    // intentionally silent
  }
}

/* =========================
   🚫 FORBIDDEN OPERATIONS
   =========================
   DO NOT ADD:
   - set-default-sink
   - restore default sink
   - ref counting
   - global audio state
*/