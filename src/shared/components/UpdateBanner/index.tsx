import * as React from "react";

import { Actions, Banner, DismissButton, Message, ReloadButton } from "./styles";

interface Props {
  onDismiss: () => void;
  onReload: () => void;
}

/**
 * Persistent bottom banner shown when the service worker detects a new app
 * version has been deployed.  Warns the user that continuing without reloading
 * may cause unexpected game behavior, and offers a one-click reload.
 *
 * `onReload` should call `updateServiceWorker(true)` from `useRegisterSW` so
 * the waiting SW receives SKIP_WAITING before the page reloads — ensuring the
 * new assets are served rather than the old cached ones.
 */
const UpdateBanner: React.FunctionComponent<Props> = ({ onDismiss, onReload }) => (
  <Banner role="alert" data-testid="update-banner">
    <Message>
      <span aria-hidden="true">⚠️ </span>A new version of BlipIt Baseball Legends is available.
      Running an outdated version may cause unexpected game behavior — reload now to update.
    </Message>
    <Actions>
      <ReloadButton onClick={onReload} aria-label="Reload app">
        <span aria-hidden="true">🔄</span> Reload app
      </ReloadButton>
      <DismissButton onClick={onDismiss} aria-label="Dismiss update notice">
        ✕
      </DismissButton>
    </Actions>
  </Banner>
);

export default UpdateBanner;
