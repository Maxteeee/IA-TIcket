import CatalogScreen from './CatalogScreen';
import { useCatalog } from '../hooks/useCatalog';

export default function ConnectedCatalogScreen({ filters, onFilters, onOpenEvent, favoriteIds = [], onToggleFavorite, saved = false, onExplore }) {
  const { events, categories, loading, error, reload } = useCatalog(filters);
  return <CatalogScreen events={events} organizers={events.map((event) => event.organizador)}
    filters={filters} onFilters={onFilters} onOpenEvent={onOpenEvent}
    favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} saved={saved} onExplore={onExplore}
    availableCategories={[{ id: 'Todos', nombre: 'Todos' }, ...categories]}
    serverFiltered loading={loading} error={error}
    onRetry={reload} onRefresh={reload} />;
}
