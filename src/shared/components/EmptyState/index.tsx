import * as React from "react";

import {
  EmptyStateAction,
  EmptyStateBody,
  EmptyStateIcon,
  EmptyStateRoot,
  EmptyStateTitle,
} from "./styles";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  body: string;
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
}

const EmptyState: React.FunctionComponent<EmptyStateProps> = ({
  icon,
  title,
  body,
  onAction,
  actionLabel,
  className,
}) => (
  <EmptyStateRoot className={className}>
    {icon !== undefined && <EmptyStateIcon>{icon}</EmptyStateIcon>}
    <EmptyStateTitle>{title}</EmptyStateTitle>
    <EmptyStateBody>{body}</EmptyStateBody>
    {onAction !== undefined && actionLabel !== undefined && (
      <EmptyStateAction onClick={onAction}>{actionLabel}</EmptyStateAction>
    )}
  </EmptyStateRoot>
);

export default EmptyState;
