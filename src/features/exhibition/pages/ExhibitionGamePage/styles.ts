import { FixedBottomBanner } from "@shared/components/FixedBottomBanner/styles";
import styled from "styled-components";

/**
 * Fixed-bottom banner shown while a career-stats commit is blocking a router
 * navigation.  Appears only for the brief window between the user's navigation
 * attempt and the commit completing, then disappears as the navigation
 * auto-proceeds.
 */
export const SavingBanner = styled(FixedBottomBanner)`
  z-index: 9999;
  text-align: center;
`;
