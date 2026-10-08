export type PokemonType = "Grass" | "Fire" | "Water";

export interface Pokemon {
  id: number;
  name: string;
  type: PokemonType;
}

const POKEDEX: Pokemon[] = [
  { id: 1, name: "Bulbasaur", type: "Grass" },
  { id: 4, name: "Charmander", type: "Fire" },
  { id: 7, name: "Squirtle", type: "Water" },
];

export function getPokemonById(id: number): Pokemon | undefined {
  return POKEDEX.find((pokemon) => pokemon.id === id);
}

export function getPokemonByName(name: string): Pokemon | undefined {
  return POKEDEX.find((pokemon) => pokemon.name.toLowerCase() === name.toLowerCase());
}

// ---------------------------------------------------------------------------
// Listing and search. Used by the HTTP layer and the CLI.
// ---------------------------------------------------------------------------

export function listPokemon(): Pokemon[] {
  return [...POKEDEX].sort((a, b) => a.id - b.id);
}

export function getPokemonByType(type: PokemonType): Pokemon[] {
  return POKEDEX.filter((pokemon) => pokemon.type === type);
}

export function listTypes(): PokemonType[] {
  return [...new Set(POKEDEX.map((pokemon) => pokemon.type))].sort();
}

// Search box input: people paste names with stray spaces and odd casing.
export function normalizeName(input: string): string {
  return input.trim().toLowerCase();
}

export function searchPokemon(query: string): Pokemon[] {
  const needle = normalizeName(query);
  if (!needle) return [];
  return POKEDEX.filter((pokemon) => pokemon.name.toLowerCase().includes(needle));
}

// ---------------------------------------------------------------------------
// Type matchups. Multipliers follow the main-series games for these three
// types only: 2 is super effective, 0.5 is not very effective, 1 is neutral.
// ---------------------------------------------------------------------------

const TYPE_CHART: Record<PokemonType, Record<PokemonType, number>> = {
  Grass: { Grass: 0.5, Fire: 0.5, Water: 2 },
  Fire: { Grass: 2, Fire: 0.5, Water: 0.5 },
  Water: { Grass: 0.5, Fire: 2, Water: 0.5 },
};

export function effectiveness(attacker: PokemonType, defender: PokemonType): number {
  return TYPE_CHART[attacker][defender];
}

export function describeMatchup(attacker: Pokemon, defender: Pokemon): string {
  const multiplier = effectiveness(attacker.type, defender.type);
  if (multiplier > 1) return `${attacker.name} is super effective against ${defender.name}.`;
  if (multiplier < 1) return `${attacker.name} is not very effective against ${defender.name}.`;
  return `${attacker.name} and ${defender.name} are evenly matched.`;
}

export function bestCounter(defender: Pokemon): Pokemon | undefined {
  let best: Pokemon | undefined;
  let bestMultiplier = 0;

  for (const candidate of POKEDEX) {
    if (candidate.id === defender.id) continue;
    const multiplier = effectiveness(candidate.type, defender.type);
    if (multiplier > bestMultiplier) {
      best = candidate;
      bestMultiplier = multiplier;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Evolutions. Only the first stage of each starter is in the Pokédex, so the
// evolved forms are referenced by name rather than by entry.
// ---------------------------------------------------------------------------

export interface Evolution {
  fromId: number;
  into: string;
  atLevel: number;
}

const EVOLUTIONS: Evolution[] = [
  { fromId: 1, into: "Ivysaur", atLevel: 16 },
  { fromId: 4, into: "Charmeleon", atLevel: 16 },
  { fromId: 7, into: "Wartortle", atLevel: 16 },
];

export function nextEvolution(pokemon: Pokemon): Evolution | undefined {
  return EVOLUTIONS.find((evolution) => evolution.fromId === pokemon.id);
}

export function canEvolve(pokemon: Pokemon, level: number): boolean {
  const evolution = nextEvolution(pokemon);
  return evolution !== undefined && level >= evolution.atLevel;
}

// ---------------------------------------------------------------------------
// Formatting for the CLI and the CSV export.
// ---------------------------------------------------------------------------

export function formatDexNumber(id: number): string {
  return `#${String(id).padStart(3, "0")}`;
}

export function formatEntry(pokemon: Pokemon): string {
  const evolution = nextEvolution(pokemon);
  const evolves = evolution ? `, evolves into ${evolution.into} at level ${evolution.atLevel}` : "";
  return `${formatDexNumber(pokemon.id)} ${pokemon.name} (${pokemon.type})${evolves}`;
}

export function toCsv(pokemon: Pokemon[]): string {
  const header = "id,name,type";
  const rows = pokemon.map((entry) => `${entry.id},${entry.name},${entry.type}`);
  return [header, ...rows].join("\n");
}

// ---------------------------------------------------------------------------
// Validation for entries arriving from the admin import endpoint.
// ---------------------------------------------------------------------------

const VALID_TYPES: readonly PokemonType[] = ["Grass", "Fire", "Water"];

export function isPokemon(input: unknown): input is Pokemon {
  if (typeof input !== "object" || input === null) return false;
  const candidate = input as Record<string, unknown>;
  return (
    typeof candidate.id === "number" &&
    Number.isInteger(candidate.id) &&
    candidate.id > 0 &&
    typeof candidate.name === "string" &&
    candidate.name.length > 0 &&
    VALID_TYPES.includes(candidate.type as PokemonType)
  );
}

export interface DexStats {
  total: number;
  byType: Record<PokemonType, number>;
  highestId: number;
}

export function dexStats(): DexStats {
  const byType: Record<PokemonType, number> = { Grass: 0, Fire: 0, Water: 0 };
  for (const pokemon of POKEDEX) byType[pokemon.type]++;

  return {
    total: POKEDEX.length,
    byType,
    highestId: Math.max(...POKEDEX.map((pokemon) => pokemon.id)),
  };
}
