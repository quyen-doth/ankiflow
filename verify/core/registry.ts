import type { ManifestEntry, VerifiableUnit, Verifier } from './types'

// Map giữ thứ tự đăng ký; ghi đè theo id vì Next dev HMR re-execute spec modules
const units = new Map<string, VerifiableUnit>()
const verifiers = new Map<string, Verifier>()

export function registerUnit<P>(unit: VerifiableUnit<P>): VerifiableUnit<P> {
  units.set(unit.id, unit as VerifiableUnit)
  return unit
}

export function registerVerifier(verifier: Verifier): Verifier {
  verifiers.set(verifier.id, verifier)
  return verifier
}

export function getUnit(id: string): VerifiableUnit | undefined {
  return units.get(id)
}

export function allUnits(): VerifiableUnit[] {
  return Array.from(units.values())
}

export function allVerifiers(): Verifier[] {
  return Array.from(verifiers.values())
}

export function verifiersFor(unit: VerifiableUnit): Verifier[] {
  const all = allVerifiers()
  if (!unit.verifiers) return all
  return all.filter(v => unit.verifiers!.includes(v.id))
}

export function buildManifest(): ManifestEntry[] {
  return allUnits().map(unit => ({
    unitId: unit.id,
    title: unit.title,
    kind: unit.kind,
    fixtures: unit.fixtures.map(f => ({
      id: f.id,
      description: f.description,
      probe: f.probe === true,
    })),
    verifiers: verifiersFor(unit).map(v => v.id),
  }))
}
