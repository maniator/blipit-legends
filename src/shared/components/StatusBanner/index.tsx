import * as React from "react";

import type { BannerVariant } from "./styles";
import { BannerAction, BannerBody, BannerContent, BannerRoot, BannerTitle } from "./styles";

interface StatusBannerProps {
  variant: BannerVariant;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const StatusBanner: React.FunctionComponent<StatusBannerProps> = ({
  variant,
  title,
  children,
  action,
  className,
}) => {
  const role = variant === "warn" ? "alert" : "status";
  const ariaLive = variant === "warn" ? undefined : ("polite" as const);

  return (
    <BannerRoot $variant={variant} role={role} aria-live={ariaLive} className={className}>
      <BannerContent>
        {title !== undefined && <BannerTitle>{title}</BannerTitle>}
        <BannerBody>{children}</BannerBody>
      </BannerContent>
      {action !== undefined && <BannerAction>{action}</BannerAction>}
    </BannerRoot>
  );
};

export default StatusBanner;
