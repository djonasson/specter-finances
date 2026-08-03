import { Group, TextInput, NumberInput, Select } from '@mantine/core';
import { CategoryIcon } from './CategoryIcon';
import { CATEGORIES, toCategory } from '../types/expense';
import type { Category } from '../types/expense';
import type { PersonNames } from '../types/person';
import { toNum, fromNum } from '../services/utils';

/**
 * The fields an expense and a recurring payment describe identically: who paid
 * how much, what for, and under which category.
 *
 * Shared because the two forms differ only in their date fields, and everything
 * below moves together — the amount pair especially. Transfers and gifts were
 * merged into one form for exactly this reason after their validation drifted
 * apart, and the same argument applies here the moment a field is added to what
 * an amount means.
 */
export interface ExpenseFieldValues {
  amountA: string;
  amountB: string;
  notCountedA: string;
  notCountedB: string;
  item: string;
  category: Category;
  notes: string;
}

interface Props {
  /** Read from the sheet — this component never knows anyone's name itself. */
  names: PersonNames;
  value: ExpenseFieldValues;
  /** Patch rather than a typed setter, so either form's wider shape fits. */
  onChange: (patch: Partial<ExpenseFieldValues>) => void;
  itemPlaceholder: string;
  /** Where the category Select lands when handed something unrecognised. */
  categoryFallback: Category;
}

export function ExpenseFields({
  names,
  value,
  onChange,
  itemPlaceholder,
  categoryFallback,
}: Props) {
  return (
    <>
      <Group grow>
        <NumberInput
          label={`${names.a} (€)`}
          prefix="€ "
          decimalScale={2}
          fixedDecimalScale
          min={0}
          placeholder="0.00"
          value={toNum(value.amountA)}
          onChange={(val) => onChange({ amountA: fromNum(val as number | '') })}
        />
        <NumberInput
          label={`${names.b} (€)`}
          prefix="€ "
          decimalScale={2}
          fixedDecimalScale
          min={0}
          placeholder="0.00"
          value={toNum(value.amountB)}
          onChange={(val) => onChange({ amountB: fromNum(val as number | '') })}
        />
      </Group>

      {/*
        Below the amounts, because that is what they are part of: a slice of the
        figure directly above, not an extra charge. Left blank on almost every
        row, so they carry no placeholder inviting a number.
      */}
      <Group grow>
        <NumberInput
          label={`${names.a} — not counted (€)`}
          prefix="€ "
          decimalScale={2}
          fixedDecimalScale
          min={0}
          value={toNum(value.notCountedA)}
          onChange={(val) => onChange({ notCountedA: fromNum(val as number | '') })}
        />
        <NumberInput
          label={`${names.b} — not counted (€)`}
          prefix="€ "
          decimalScale={2}
          fixedDecimalScale
          min={0}
          value={toNum(value.notCountedB)}
          onChange={(val) => onChange({ notCountedB: fromNum(val as number | '') })}
        />
      </Group>

      <TextInput
        label="Item"
        value={value.item}
        onChange={(e) => onChange({ item: e.currentTarget.value })}
        placeholder={itemPlaceholder}
        required
      />

      <Select
        label="Category"
        value={value.category}
        onChange={(val) => onChange({ category: toCategory(val ?? '') || categoryFallback })}
        data={CATEGORIES as unknown as string[]}
        allowDeselect={false}
        leftSection={<CategoryIcon category={value.category} size={16} />}
        renderOption={({ option }) => (
          <Group gap="xs">
            <CategoryIcon category={option.value} size={16} />
            {option.value}
          </Group>
        )}
      />

      <TextInput
        label="Notes"
        value={value.notes}
        onChange={(e) => onChange({ notes: e.currentTarget.value })}
        placeholder="Optional"
      />
    </>
  );
}
