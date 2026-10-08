import { describe, expect, it } from "vitest";
import { getPokemonByName } from "./pokedex.ts";

describe("getPokemonByName", () => {
  it("finds a pokemon case-insensitively", () => {
    expect(getPokemonByName("charmander")?.id).toBe(4);
  });

  it("finds a pokemon with surrounding whitespace", () => {
    expect(getPokemonByName(" Squirtle ")?.id).toBe(7);
  });
});
