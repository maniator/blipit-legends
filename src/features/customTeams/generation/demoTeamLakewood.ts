import type { DemoTeamDef } from "./demoTeamTypes";

/**
 * Lakewood Legends — one of the demo starter teams seeded on first launch.
 * Stat constraints: hitters contact+power+speed = 150; pitchers velocity+control+movement = 160.
 */
export const LAKEWOOD_LEGENDS: DemoTeamDef = {
  demoId: "ct_demo_lak",
  city: "Lakewood",
  name: "Legends",
  abbreviation: "LAK",
  lineup: [
    // contact + power + speed = 150; each of the 9 BATTING_POSITIONS exactly once
    {
      name: "Trevor Walsh",
      role: "batter",
      batting: { contact: 58, power: 52, speed: 40 },
      position: "C",
      handedness: "R",
    },
    {
      name: "Dominic Santos",
      role: "batter",
      batting: { contact: 50, power: 60, speed: 40 },
      position: "1B",
      handedness: "R",
    },
    {
      name: "Leo Martinez",
      role: "batter",
      batting: { contact: 65, power: 45, speed: 40 },
      position: "2B",
      handedness: "L",
    },
    {
      name: "Patrick O'Brien",
      role: "batter",
      batting: { contact: 45, power: 65, speed: 40 },
      position: "3B",
      handedness: "R",
    },
    {
      name: "Cole Henderson",
      role: "batter",
      batting: { contact: 52, power: 58, speed: 40 },
      position: "SS",
      handedness: "R",
    },
    {
      name: "Ryan Nguyen",
      role: "batter",
      batting: { contact: 50, power: 50, speed: 50 },
      position: "LF",
      handedness: "R",
    },
    {
      name: "Alex Patel",
      role: "batter",
      batting: { contact: 55, power: 55, speed: 40 },
      position: "CF",
      handedness: "R",
    },
    {
      name: "Sean McCoy",
      role: "batter",
      batting: { contact: 48, power: 62, speed: 40 },
      position: "RF",
      handedness: "R",
    },
    {
      name: "Jake Flores",
      role: "batter",
      batting: { contact: 53, power: 57, speed: 40 },
      position: "DH",
      handedness: "R",
    },
  ],
  bench: [
    {
      name: "Mike Garcia",
      role: "batter",
      batting: { contact: 55, power: 55, speed: 40 },
      position: "3B",
      handedness: "R",
    },
    {
      name: "Noah Williams",
      role: "batter",
      batting: { contact: 60, power: 50, speed: 40 },
      position: "1B",
      handedness: "L",
    },
    {
      name: "Chris Baker",
      role: "batter",
      batting: { contact: 50, power: 60, speed: 40 },
      position: "LF",
      handedness: "R",
    },
    {
      name: "Sam Turner",
      role: "batter",
      batting: { contact: 52, power: 58, speed: 40 },
      position: "SS",
      handedness: "R",
    },
  ],
  pitchers: [
    // velocity + control + movement = 160
    {
      name: "Victor Cruz",
      role: "pitcher",
      batting: { contact: 40, power: 40, speed: 40 },
      pitching: { velocity: 65, control: 50, movement: 45 },
      position: "SP",
      handedness: "R",
      pitchingRole: "SP",
    },
    {
      name: "Eric Dawson",
      role: "pitcher",
      batting: { contact: 40, power: 40, speed: 40 },
      pitching: { velocity: 55, control: 60, movement: 45 },
      position: "SP",
      handedness: "R",
      pitchingRole: "SP",
    },
    {
      name: "Todd Morrison",
      role: "pitcher",
      batting: { contact: 40, power: 40, speed: 40 },
      pitching: { velocity: 50, control: 55, movement: 55 },
      position: "RP",
      handedness: "L",
      pitchingRole: "RP",
    },
    {
      name: "Jared Kim",
      role: "pitcher",
      batting: { contact: 40, power: 40, speed: 40 },
      pitching: { velocity: 60, control: 55, movement: 45 },
      position: "RP",
      handedness: "R",
      pitchingRole: "RP",
    },
  ],
};
