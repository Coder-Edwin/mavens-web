import { describe, it, expect } from 'vitest';
import { jitsiRoomName } from './classroom';

describe('jitsiRoomName', () => {
  it('namespaces the room code so it does not collide with a public meet.jit.si room', () => {
    expect(jitsiRoomName('ABC123')).toBe('MavensClassroom-ABC123');
  });
});
