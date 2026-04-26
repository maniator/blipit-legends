import * as React from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { EditorPlayer, EditorPlayerPatch } from "./editorState";
import {
  BATTER_POSITION_OPTIONS,
  HANDEDNESS_OPTIONS,
  PITCHER_POSITION_OPTIONS,
} from "./playerConstants";
import PlayerStatFields from "./PlayerStatFields";
import {
  FieldLabel,
  MetaGroup,
  PlayerCard,
  PlayerHeader,
  PlayerMeta,
  ReadOnlyInput,
  RemoveBtn,
  SelectInput,
  SmallIconBtn,
  TextInput,
} from "./styles";

type Props = {
  player: EditorPlayer;
  isPitcher?: boolean;
  isExistingPlayer?: boolean;
  /**
   * True when this row was just added by the user via an "Add player" button.
   * Triggers focus/select on the name input on next paint and a brief
   * highlight animation. Honoured only for the initial mount that observes
   * this flag — the animation is one-shot.
   */
  isNewlyAdded?: boolean;
  onChange: (patch: EditorPlayerPatch) => void;
  onRemove: () => void;
  /** Called when the user clicks the export button. Undefined = no export button shown. */
  onExport?: () => void;
};

const SortablePlayerRow: React.FunctionComponent<Props> = ({
  player,
  isPitcher = false,
  isExistingPlayer = false,
  isNewlyAdded = false,
  onChange,
  onRemove,
  onExport,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: player.id,
  });

  const nameInputRef = React.useRef<HTMLInputElement>(null);
  // Capture the "newly added" flag at first mount so subsequent re-renders
  // (e.g. drag-reorder) don't re-trigger the focus/select behaviour.
  const initialNewlyAddedRef = React.useRef(isNewlyAdded);

  React.useEffect(() => {
    if (!initialNewlyAddedRef.current) return;
    if (isExistingPlayer) return; // existing players have a read-only name
    const raf = requestAnimationFrame(() => {
      const el = nameInputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
    return () => cancelAnimationFrame(raf);
  }, [isExistingPlayer]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const positionOptions = isPitcher ? PITCHER_POSITION_OPTIONS : BATTER_POSITION_OPTIONS;
  const groupAriaLabel = `New ${isPitcher ? "pitcher" : "batter"}, position ${
    player.position || "unset"
  }`;

  return (
    <PlayerCard
      ref={setNodeRef}
      style={style}
      $isNewlyAdded={initialNewlyAddedRef.current}
      {...(initialNewlyAddedRef.current ? { role: "group", "aria-label": groupAriaLabel } : {})}
    >
      <PlayerHeader>
        <span
          {...attributes}
          {...listeners}
          aria-label={`Drag ${player.name || "player"} to reorder`}
          style={{
            cursor: isDragging ? "grabbing" : "grab",
            color: "#4a6090",
            fontSize: "16px",
            flexShrink: 0,
            lineHeight: 1,
            padding: "0 4px",
            touchAction: "none",
          }}
        >
          ⠿
        </span>
        {isExistingPlayer ? (
          <ReadOnlyInput
            value={player.name}
            readOnly
            aria-readonly="true"
            aria-label="Player name"
            style={{ flex: 1 }}
          />
        ) : (
          <TextInput
            id={`name-${player.id}`}
            ref={nameInputRef}
            value={player.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ name: e.target.value })
            }
            placeholder="Player name"
            aria-label="Player name"
            aria-invalid={!player.name.trim() ? "true" : undefined}
            style={{ flex: 1 }}
          />
        )}
        {onExport && (
          <SmallIconBtn
            type="button"
            onClick={onExport}
            aria-label="Export player"
            title="Export player"
            data-testid="export-player-button"
          >
            ↓ Export
          </SmallIconBtn>
        )}
        <RemoveBtn type="button" onClick={onRemove} aria-label="Remove player">
          ✕
        </RemoveBtn>
      </PlayerHeader>
      <PlayerMeta>
        <MetaGroup>
          <FieldLabel htmlFor={`pos-${player.id}`}>Position</FieldLabel>
          <SelectInput
            id={`pos-${player.id}`}
            value={player.position}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              onChange({ position: e.target.value })
            }
            aria-label="Position"
            data-testid="custom-team-player-position-select"
          >
            <option value="">— select —</option>
            {positionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </SelectInput>
        </MetaGroup>
        <MetaGroup>
          <FieldLabel htmlFor={`hand-${player.id}`}>{isPitcher ? "Throws" : "Bats"}</FieldLabel>
          <SelectInput
            id={`hand-${player.id}`}
            value={player.handedness}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              onChange({ handedness: e.target.value as "R" | "L" | "S" })
            }
            aria-label={isPitcher ? "Throwing handedness" : "Batting handedness"}
            data-testid="custom-team-player-handedness-select"
          >
            {HANDEDNESS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </SelectInput>
        </MetaGroup>
      </PlayerMeta>
      <PlayerStatFields player={player} isExistingPlayer={isExistingPlayer} onChange={onChange} />
    </PlayerCard>
  );
};

export default SortablePlayerRow;
