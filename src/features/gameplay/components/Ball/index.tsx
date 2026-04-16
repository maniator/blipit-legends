import * as React from "react";

import { useGameContext } from "@feat/gameplay/context/index";
import { Hit } from "@shared/constants/hitTypes";

import { hitDistances } from "./constants";
import { Baseball } from "./styles";

const Ball: React.FunctionComponent = () => {
  const { hitType, pitchKey } = useGameContext();

  const isHit = hitType !== undefined && hitType !== Hit.Walk && hitType !== Hit.HitByPitch;
  const dist = isHit ? hitDistances[hitType!] : 0;

  // key={pitchKey} forces a remount on every pitch, restarting the animation cleanly.
  return <Baseball key={pitchKey ?? 0} $isHit={isHit} $dist={dist} />;
};

export default Ball;
