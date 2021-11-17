// @flow

export type FavoritesConfig = {
  favoriteIcon: string,
  position: 'prepend' | 'append',
}

export const getFavoriteDefault = (): string => '⭐️'

export const filterForFaves = (notes: $ReadOnlyArray<TNote>, config: FavoritesConfig): Array<TNote> =>
  notes.filter((n) => hasFavoriteIcon(n.title || '', config.favoriteIcon))

export const getFaveOptionsArray = (notes: Array<TNote>): Array<{ label: string, value: string }> =>
  notes
    .filter((n) => Boolean(n.title && n.filename))
    .map((n) => {
      // $FlowIgnore
      return { label: n.title, value: n.filename }
    })

export const hasFavoriteIcon = (title: string, icon: string): boolean => title.search(icon) !== -1

export const getFavoritedTitle = (title: string, position: string, icon: string): string => {
  return position === 'prepend' ? `${icon} ${title}` : `${title} ${icon}`
}

export const removeFavoriteFromTitle = (title: string, icon: string): string => {
  return title.replace(icon, '').trim().replace('  ', ' ')
}
