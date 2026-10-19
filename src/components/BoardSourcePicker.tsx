import type { BoardStop } from '../shared/memory-boards';
import { PrivateRecordPicker } from './PrivateRecordPicker';
export function BoardSourcePicker({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (entry: BoardStop) => void;
}) {
  return (
    <PrivateRecordPicker
      disabled={disabled}
      onPick={(row) =>
        onAdd({
          id: crypto.randomUUID(),
          name: row.name,
          note: '',
          day: null,
          time: '',
          location: '',
          reference: { kind: row.kind, id: row.id },
          referenceMissing: false,
          photo: false,
        })
      }
    />
  );
}
