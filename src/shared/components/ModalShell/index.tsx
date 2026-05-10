import * as React from "react";

import {
  ModalBody,
  ModalCloseButton,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "./styles";

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  open?: boolean;
  className?: string;
}

const ModalShell: React.FunctionComponent<ModalShellProps> = ({
  title,
  onClose,
  children,
  footer,
  open = false,
  className,
}) => {
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [open]);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
    };
  }, [onClose]);

  return (
    <ModalDialog ref={dialogRef} className={className}>
      <ModalHeader>
        <ModalTitle>{title}</ModalTitle>
        <ModalCloseButton onClick={onClose} aria-label="Close dialog">
          ×
        </ModalCloseButton>
      </ModalHeader>
      <ModalBody>{children}</ModalBody>
      {footer !== undefined && <ModalFooter>{footer}</ModalFooter>}
    </ModalDialog>
  );
};

export default ModalShell;
