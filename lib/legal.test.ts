import { describe, expect, it } from 'vitest';
import {
  ABOUT_BODY,
  CONTACT_EMAIL,
  HEALTH_DATA_INTRO,
  HEALTH_DATA_READ_BODY,
  HEALTH_DATA_STOP_BODY,
  HEALTH_DATA_STORE_BODY,
  PRIVACY_CONTACT_BODY,
  PRIVACY_WHOOP_BODY,
} from './legal';

describe('legal copy', () => {
  it('uses Amy contact email and names the health cookie rules', () => {
    expect(CONTACT_EMAIL).toBe('hello@example.com');
    expect(PRIVACY_CONTACT_BODY).toContain(CONTACT_EMAIL);
    expect(PRIVACY_WHOOP_BODY).toMatch(/whoop_session cookie/);
    expect(PRIVACY_WHOOP_BODY).toMatch(/does not write WHOOP data to a database/);
    expect(HEALTH_DATA_STORE_BODY).toMatch(/does not keep a database/);
    expect(HEALTH_DATA_READ_BODY).toMatch(/Recovery, sleep, and daily cycles/);
    expect(HEALTH_DATA_STOP_BODY).toMatch(/remove Focus Orb in the WHOOP app/);
    expect(HEALTH_DATA_INTRO).toMatch(/consumer health data policy/);
    expect(ABOUT_BODY).toMatch(/invite-only/);
  });

  it('stays free of em dashes', () => {
    const copy = [
      ABOUT_BODY,
      PRIVACY_WHOOP_BODY,
      PRIVACY_CONTACT_BODY,
      HEALTH_DATA_INTRO,
      HEALTH_DATA_READ_BODY,
      HEALTH_DATA_STORE_BODY,
      HEALTH_DATA_STOP_BODY,
    ].join('\n');
    expect(copy).not.toMatch(/[—–]/);
  });
});
