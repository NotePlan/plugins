// @flow strict

export type Option<T> = $ReadOnly<{
  label: string,
  value: T,
}>;

export async function chooseOption<T, TDefault = T>(
  title: string,
  options: $ReadOnlyArray<Option<T>>,
  defaultValue: TDefault,
): Promise<T | TDefault> {
  const { index } = await CommandBar.showOptions(
    options.map((option) => option.label),
    title,
  );
  return options[index]?.value ?? defaultValue;
}

export async function showMessage(title: string): Promise<void> {
  await CommandBar.showOptions(['OK'], title);
}

export async function getInput(title: string): Promise<string> {
  return await CommandBar.showInput(title, 'OK');
}
