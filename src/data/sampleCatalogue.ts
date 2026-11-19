import { SatelliteRecord } from '../types/orbit';

/**
 * Deterministic PRNG (Mulberry32) so the illustrative sample orbital catalogue
 * is reproducible and physically coherent for data mining demonstrations.
 */
function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number, mean: number, std: number): number {
  const u1 = Math.max(1e-7, rng());
  const u2 = rng();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z * std;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

const EARTH_RADIUS_KM = 6371.0;
const MU_EARTH = 398600.4418; // km^3 / s^2

function computeOrbitalKinematics(apogeeKm: number, perigeeKm: number) {
  const ra = EARTH_RADIUS_KM + Math.max(apogeeKm, perigeeKm);
  const rp = EARTH_RADIUS_KM + Math.min(apogeeKm, perigeeKm);
  const a = (ra + rp) / 2;
  const eccentricity = (ra - rp) / (ra + rp);
  const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / MU_EARTH);
  const orbitalPeriodMin = periodSeconds / 60;
  const meanMotionRevDay = 1440 / orbitalPeriodMin;
  const meanAltitudeKm = a - EARTH_RADIUS_KM;
  return {
    mean_altitude_km: Number(meanAltitudeKm.toFixed(2)),
    eccentricity: Number(eccentricity.toFixed(6)),
    orbital_period_min: Number(orbitalPeriodMin.toFixed(2)),
    mean_motion_rev_day: Number(meanMotionRevDay.toFixed(5)),
  };
}

const PAYLOAD_PREFIXES = ['SENTINEL', 'STARLINK', 'GALILEO', 'NOAA', 'LANDSAT', 'IRIDIUM', 'TERRA', 'METEOSAT', 'GPS-III', 'COSMO-SKY'];
const ROCKET_PREFIXES = ['FALCON-9 R/B', 'ARIANE-5 DEB', 'SOYUZ-2 R/B', 'ATLAS-V CENTAUR', 'SL-16 R/B', 'DELTA-IV R/B', 'CZ-2D R/B'];
const DEBRIS_PREFIXES = ['COSMOS-1408 DEB', 'FENGYUN-1C DEB', 'IRIDIUM-33 DEB', 'SL-12 DEB', 'BREEZE-M DEB', 'PEGASUS DEB'];

export function generateIllustrativeOrbitalCatalogue(count = 420): SatelliteRecord[] {
  const rng = createRng(20261119);
  const records: SatelliteRecord[] = [];

  for (let i = 0; i < count; i++) {
    const roll = rng();
    const isPayload = roll < 0.48;
    const isRocketBody = !isPayload && roll < 0.72;
    const objectType = isPayload ? 'PAYLOAD' : isRocketBody ? 'ROCKET BODY' : 'DEBRIS';

    // Select orbital regime realistically by object type
    const regimeRoll = rng();
    let regime: 'LEO' | 'MEO' | 'GEO' | 'HEO' = 'LEO';
    if (isPayload) {
      if (regimeRoll < 0.62) regime = 'LEO';
      else if (regimeRoll < 0.78) regime = 'MEO';
      else if (regimeRoll < 0.95) regime = 'GEO';
      else regime = 'HEO';
    } else if (isRocketBody) {
      if (regimeRoll < 0.56) regime = 'LEO';
      else if (regimeRoll < 0.74) regime = 'HEO'; // GTO stages
      else if (regimeRoll < 0.88) regime = 'MEO';
      else regime = 'GEO';
    } else {
      if (regimeRoll < 0.78) regime = 'LEO';
      else if (regimeRoll < 0.92) regime = 'HEO';
      else regime = 'MEO';
    }

    let perigee = 550;
    let apogee = 560;
    let inclination = 53;

    if (regime === 'LEO') {
      if (isPayload) {
        perigee = clamp(gaussian(rng, 580, 140), 310, 1450);
        apogee = perigee + clamp(Math.abs(gaussian(rng, 14, 18)), 1, 90);
        inclination = rng() < 0.5 ? clamp(gaussian(rng, 97.6, 1.8), 88, 102) : clamp(gaussian(rng, 53.0, 12), 20, 86);
      } else if (isRocketBody) {
        perigee = clamp(gaussian(rng, 640, 210), 260, 1650);
        apogee = perigee + clamp(Math.abs(gaussian(rng, 75, 55)), 10, 420);
        inclination = clamp(gaussian(rng, 78, 18), 28, 101);
      } else {
        perigee = clamp(gaussian(rng, 760, 240), 240, 1750);
        apogee = perigee + clamp(Math.abs(gaussian(rng, 180, 130)), 25, 950);
        inclination = clamp(gaussian(rng, 82, 16), 25, 108);
      }
    } else if (regime === 'MEO') {
      perigee = clamp(gaussian(rng, 19800, 1600), 14000, 24500);
      apogee = perigee + clamp(Math.abs(gaussian(rng, isPayload ? 60 : 320, 140)), 10, 1400);
      inclination = clamp(gaussian(rng, 55.2, 4.5), 42, 68);
    } else if (regime === 'GEO') {
      perigee = clamp(gaussian(rng, 35760, 120), 35200, 36200);
      apogee = perigee + clamp(Math.abs(gaussian(rng, isPayload ? 18 : 160, 60)), 2, 550);
      inclination = isPayload ? clamp(Math.abs(gaussian(rng, 0.4, 0.8)), 0.01, 4.5) : clamp(gaussian(rng, 9.5, 4.2), 1.5, 16.5);
    } else {
      // HEO / GTO
      perigee = clamp(gaussian(rng, 380, 160), 185, 1100);
      apogee = clamp(gaussian(rng, isRocketBody ? 35600 : 28000, 4200), 14000, 42000);
      inclination = clamp(gaussian(rng, isPayload ? 63.4 : 26.5, 8.5), 7, 72);
    }

    // Physical Radar Cross Section (RCS) and B* atmospheric drag coefficient
    let rcs = 1.0;
    let bstar = 0.0001;
    if (isPayload) {
      rcs = clamp(Math.exp(gaussian(rng, 1.15, 0.75)), 0.35, 38.0);
      bstar = regime === 'LEO' ? clamp(Math.abs(gaussian(rng, 0.00012, 0.00009)), 0.00001, 0.0006) : clamp(Math.abs(gaussian(rng, 0.00001, 0.00001)), 0, 0.00005);
    } else if (isRocketBody) {
      rcs = clamp(Math.exp(gaussian(rng, 1.95, 0.55)), 1.8, 52.0);
      bstar = regime === 'LEO' ? clamp(Math.abs(gaussian(rng, 0.00038, 0.00022)), 0.00005, 0.0018) : clamp(Math.abs(gaussian(rng, 0.00003, 0.00002)), 0, 0.00012);
    } else {
      rcs = clamp(Math.exp(gaussian(rng, -2.3, 0.85)), 0.004, 0.45);
      bstar = regime === 'LEO' ? clamp(Math.abs(gaussian(rng, 0.0014, 0.0009)), 0.0002, 0.0065) : clamp(Math.abs(gaussian(rng, 0.00009, 0.00006)), 0.00001, 0.0004);
    }

    // Inject ~14 intentional orbital anomalies for Isolation Forest discovery
    const isIntentionalAnomaly = i >= 12 && i < 28 && i % 2 === 0;
    if (isIntentionalAnomaly) {
      if (i % 4 === 0) {
        // Extreme retrograde high-drag decaying fragment
        inclination = 142.4 + rng() * 6;
        perigee = 215 + rng() * 35;
        apogee = 2850 + rng() * 900;
        bstar = 0.0145 + rng() * 0.008;
      } else {
        // Super-GEO graveyard or unusually large cross-section eccentric orbit
        perigee = 36500 + rng() * 1400;
        apogee = 44200 + rng() * 2200;
        eccentricityOverride(apogee, perigee);
        rcs = 64.0 + rng() * 18;
      }
    }

    function eccentricityOverride(a: number, p: number) {
      apogee = a;
      perigee = p;
    }

    const kin = computeOrbitalKinematics(apogee, perigee);
    const launchYear = Math.floor(clamp(gaussian(rng, isPayload ? 2020 : isRocketBody ? 2012 : 2009, 6), 1984, 2026));
    const noradId = String(24000 + i * 73 + Math.floor(rng() * 19));

    const prefixList = isPayload ? PAYLOAD_PREFIXES : isRocketBody ? ROCKET_PREFIXES : DEBRIS_PREFIXES;
    const prefix = prefixList[i % prefixList.length];
    const objectName = `${prefix}-${100 + (i % 899)}`;

    const record: SatelliteRecord = {
      norad_id: noradId,
      object_name: objectName,
      object_type: objectType,
      orbit_regime: regime,
      apogee_km: Number(apogee.toFixed(2)),
      perigee_km: Number(perigee.toFixed(2)),
      mean_altitude_km: kin.mean_altitude_km,
      inclination_deg: Number(inclination.toFixed(3)),
      eccentricity: kin.eccentricity,
      mean_motion_rev_day: kin.mean_motion_rev_day,
      orbital_period_min: kin.orbital_period_min,
      bstar_drag: Number(bstar.toFixed(6)),
      rcs_m2: Number(rcs.toFixed(4)),
      launch_year: launchYear,
    };

    // Inject realistic sparse missing values (~3.5%) so Data Wrangling has real work to clean
    if (!isIntentionalAnomaly && i > 15) {
      if (rng() < 0.035) record.bstar_drag = null;
      if (rng() < 0.03) record.rcs_m2 = null;
      if (rng() < 0.02) record.inclination_deg = null;
      if (rng() < 0.015) record.apogee_km = null;
    }

    records.push(record);
  }

  // Inject 8 exact duplicate records to demonstrate real duplicate detection & removal
  for (let d = 0; d < 8; d++) {
    const source = records[d * 17 + 3];
    records.splice(d * 21 + 10, 0, { ...source });
  }

  return records;
}
