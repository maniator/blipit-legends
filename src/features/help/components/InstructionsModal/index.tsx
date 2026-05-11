import * as React from "react";

import HelpContent from "../HelpContent";
import {
  CloseButton,
  CloseXButton,
  Dialog,
  DialogHeader,
  DialogTitle,
  HelpButton,
  ScrollBody,
} from "./styles";

const InstructionsModal: React.FunctionComponent = () => {
  const ref = React.useRef<HTMLDialogElement>(null);

  const open = () => ref.current?.showModal();
  const close = () => ref.current?.close();

  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const outside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom;
    if (outside) close();
  };

  return (
    <>
      <HelpButton onClick={open} aria-label="How to play" data-testid="instructions-help-button">
        ?
      </HelpButton>

      <Dialog ref={ref} onClick={handleClick} data-testid="instructions-modal">
        <DialogHeader>
          <DialogTitle>⚾ How to Play</DialogTitle>
          <CloseXButton onClick={close} aria-label="Close" data-testid="instructions-close-button">
            ✕
          </CloseXButton>
        </DialogHeader>

        <ScrollBody>
          <HelpContent />
          <CloseButton onClick={close}>Got it!</CloseButton>
        </ScrollBody>
      </Dialog>
    </>
  );
};

export default InstructionsModal;
