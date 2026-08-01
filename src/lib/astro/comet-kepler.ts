// Keplerian propagation for comets: from orbital elements to a heliocentric
// position, at any date. Handles elliptical, near-parabolic and hyperbolic
// orbits (comets come in all three). Pure math, no dependencies.

const GAUSS_K = 0.01720209895; // Gaussian gravitational constant, rad/day

export interface OrbitalElements {
  q: number; // perihelion distance, AU
  e: number; // eccentricity
  iDeg: number; // inclination, deg (J2000 ecliptic)
  nodeDeg: number; // longitude of ascending node, deg
  periDeg: number; // argument of perihelion, deg
  tp: number; // perihelion time, unix ms
}

export interface HelioPos {
  // heliocentric ecliptic J2000 rectangular, AU
  x: number;
  y: number;
  z: number;
  r: number; // heliocentric distance, AU
}

function solveElliptical(M: number, e: number): number {
  // Kepler's equation, E - e sin E = M, by Newton-Raphson
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 100; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

function solveHyperbolic(M: number, e: number): number {
  // M = e sinh F - F
  let F = Math.log(2 * Math.abs(M) / e + 1.8) * Math.sign(M || 1);
  for (let i = 0; i < 100; i++) {
    const dF = (e * Math.sinh(F) - F - M) / (e * Math.cosh(F) - 1);
    F -= dF;
    if (Math.abs(dF) < 1e-12) break;
  }
  return F;
}

/** True anomaly (rad) and heliocentric distance r (AU) at time `atMs`. */
function anomaly(el: OrbitalElements, atMs: number): { nu: number; r: number } {
  const dtDays = (atMs - el.tp) / 86400000;
  const e = el.e;

  if (Math.abs(e - 1) < 5e-3) {
    // near-parabolic: Barker's equation. Solve s^3 + 3s = W for s = tan(nu/2)
    // via Cardano, where s = Y - 1/Y, Y = cbrt(G + sqrt(G^2 + 1)), G = W/2.
    const W = (0.03649116245 / (el.q * Math.sqrt(el.q))) * dtDays;
    const G = W / 2;
    const Y = Math.cbrt(G + Math.sqrt(G * G + 1));
    const s = Y - 1 / Y;
    const nu = 2 * Math.atan(s);
    const r = el.q * (1 + s * s);
    return { nu, r };
  }

  if (e < 1) {
    const a = el.q / (1 - e);
    const n = GAUSS_K / (a * Math.sqrt(a));
    let M = n * dtDays;
    M = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const E = solveElliptical(M, e);
    const nu = 2 * Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2),
    );
    const r = a * (1 - e * Math.cos(E));
    return { nu, r };
  }

  // hyperbolic
  const a = el.q / (e - 1); // positive
  const n = GAUSS_K / (a * Math.sqrt(a));
  const M = n * dtDays;
  const F = solveHyperbolic(M, e);
  const nu = 2 * Math.atan2(
    Math.sqrt(e + 1) * Math.sinh(F / 2),
    Math.sqrt(e - 1) * Math.cosh(F / 2),
  );
  const r = a * (e * Math.cosh(F) - 1);
  return { nu, r };
}

/** Heliocentric ecliptic J2000 position of the comet at `atMs`. */
export function cometHeliocentric(el: OrbitalElements, atMs: number): HelioPos {
  const { nu, r } = anomaly(el, atMs);
  const xp = r * Math.cos(nu);
  const yp = r * Math.sin(nu);

  const i = (el.iDeg * Math.PI) / 180;
  const O = (el.nodeDeg * Math.PI) / 180;
  const w = (el.periDeg * Math.PI) / 180;

  const cosO = Math.cos(O), sinO = Math.sin(O);
  const cosi = Math.cos(i), sini = Math.sin(i);
  const cosw = Math.cos(w), sinw = Math.sin(w);

  const x =
    (cosO * cosw - sinO * sinw * cosi) * xp +
    (-cosO * sinw - sinO * cosw * cosi) * yp;
  const y =
    (sinO * cosw + cosO * sinw * cosi) * xp +
    (-sinO * sinw + cosO * cosw * cosi) * yp;
  const z = (sinw * sini) * xp + (cosw * sini) * yp;

  return { x, y, z, r };
}
