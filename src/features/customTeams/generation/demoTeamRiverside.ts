import type { DemoTeamDef } from "./demoTeamTypes";

/**
 * Riverside Rockets — one of the demo starter teams seeded on first launch.
 * Stat constraints: hitters contact+power+speed = 150; pitchers velocity+control+movement = 160.
 */
export const RIVERSIDE_ROCKETS: DemoTeamDef = {
  demoId: "ct_demo_riv",
  city: "Riverside",
  name: "Rockets",
  abbreviation: "RIV",
  lineup: [
    // contact + power + speed = 150; each of the 9 BATTING_POSITIONS exactly once
    {
      name: "Marcus Rivera",
      role: "batter",
      batting: { contact: 60, power: 50, speed: 40 },
      position: "C",
      handedness: "R",
    },
    {
      name: "Jordan Hayes",
      role: "batter",
      batting: { contact: 50, power: 60, speed: 40 },
      position: "1B",
      handedness: "R",
    },
    {
      name: "Tyler Brooks",
      role: "batter",
      batting: { contact: 55, power: 55, speed: 40 },
      position: "2B",
      handedness: "R",
    },
    {
      name: "Devon Carter",
      role: "batter",
      batting: { contact: 45, power: 65, speed: 40 },
      position: "3B",
      handedness: "L",
    },
    {
      name: "Malik Johnson",
      role: "batter",
      batting: { contact: 55, power: 50, speed: 45 },
      position: "SS",
      handedness: "R",
    },
    {
      name: "Ethan Torres",
      role: "batter",
      batting: { contact: 50, power: 50, speed: 50 },
      position: "LF",
      handedness: "R",
    },
    {
      name: "Sean Mitchell",
      role: "batter",
      batting: { contact: 58, power: 52, speed: 40 },
      position: "CF",
      handedness: "R",
    },
    {
      name: "Aaron Pena",
      role: "batter",
      batting: { contact: 48, power: 62, speed: 40 },
      position: "RF",
      handedness: "R",
    },
    {
      name: "Kyle Simmons",
      role: "batter",
      batting: { contact: 52, power: 58, speed: 40 },
      position: "DH",
      handedness: "R",
    },
  ],
  bench: [
    {
      name: "Carlos Reyes",
      role: "batter",
      batting: { contact: 60, power: 50, speed: 40 },
      position: "C",
      handedness: "R",
    },
    {
      name: "Omar Diaz",
      role: "batter",
      batting: { contact: 50, power: 60, speed: 40 },
      position: "1B",
      handedness: "L",
    },
    {
      name: "Justin Lee",
      role: "batter",
      batting: { contact: 55, power: 55, speed: 40 },
      position: "LF",
      handedness: "R",
    },
    {
      name: "Brandon Cruz",
      role: "batter",
      batting: { contact: 53, power: 57, speed: 40 },
      position: "SS",
      handedness: "R",
    },
  ],
  pitchers: [
    // velocity + control + movement = 160
    {
      name: "Rafael Gomez",
      role: "pitcher",
      batting: { contact: 40, power: 40, speed: 40 },
      pitching: { velocity: 60, control: 55, movement: 45 },
      position: "SP",
      handedness: "R",
      pitchingRole: "SP",
    },
    {
      name: "Darius Webb",
      role: "pitcher",
      batting: { contact: 40, power: 40, speed: 40 },
      pitching: { velocity: 55, control: 60, movement: 45 },
      position: "SP",
      handedness: "L",
      pitchingRole: "SP",
    },
    {
      name: "Lance Freeman",
      role: "pitcher",
      batting: { contact: 40, power: 40, speed: 40 },
      pitching: { velocity: 50, control: 60, movement: 50 },
      position: "RP",
      handedness: "R",
      pitchingRole: "RP",
    },
    {
      name: "Nathan Park",
      role: "pitcher",
      batting: { contact: 40, power: 40, speed: 40 },
      pitching: { velocity: 55, control: 55, movement: 50 },
      position: "RP",
      handedness: "R",
      pitchingRole: "RP",
    },
  ],
};
